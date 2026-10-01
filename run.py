# -*- encoding: utf-8 -*-
"""
Copyright (c) 2019 - present AppSeed.us
"""
import logging
import os
from sys import exit
from logging.handlers import RotatingFileHandler

from flask_migrate import Migrate
from flask_minify import Minify

from apps import create_app, db

# WARNING: Don't run with debug turned on in production!
from apps.config import config_dict

DEBUG = os.getenv("DEBUG", "False") == "True"

# The configuration
get_config_mode = "Debug" if DEBUG else "Production"

try:

    # Load the configuration using the default values
    app_config = config_dict[get_config_mode.capitalize()]

except KeyError:
    exit("Error: Invalid <config_mode>. Expected values [Debug, Production] ")

print("Executing Run module...")
app = create_app(app_config)
Migrate(app, db)
print("Application db migrated...")

# Configure file logging to sentiboard.log
if not app.debug or True:  # Always log to file, even in debug mode
    # Create logs directory if it doesn't exist
    log_dir = os.path.join(os.path.dirname(__file__), "logs")
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)

    log_file = os.path.join(log_dir, "sentiboard.log")

    # Set up rotating file handler (max 10MB per file, keep 10 backup files)
    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=10
    )

    # Set log format
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    file_handler.setFormatter(formatter)
    file_handler.setLevel(logging.INFO)

    # Add handler to ROOT logger only (avoid duplicate logging to app.logger)
    root_logger = logging.getLogger()
    root_logger.addHandler(file_handler)
    root_logger.setLevel(logging.INFO)

    app.logger.info("=" * 80)
    app.logger.info("SentiBoard Application Started - Logging to: " + log_file)
    app.logger.info("=" * 80)

if not DEBUG:
    Minify(app=app, html=True, js=False, cssless=False)

if DEBUG:
    app.logger.info("DEBUG            = " + str(DEBUG))
    app.logger.info("FLASK_ENV        = " + os.getenv("FLASK_ENV"))
    app.logger.info("Page Compression = " + "FALSE" if DEBUG else "TRUE")
    app.logger.info("DBMS             = " + app_config.SQLALCHEMY_DATABASE_URI)
    app.logger.info("ASSETS_ROOT      = " + app_config.ASSETS_ROOT)

if __name__ == "__main__":
    app.run()
else:
    gunicorn_logger = logging.getLogger("gunicorn.error")
    if gunicorn_logger:
        app.logger.handlers = gunicorn_logger.handlers
        app.logger.setLevel(gunicorn_logger.level)
