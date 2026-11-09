"""opensearch_config: environment in, client keyword arguments out."""

import pytest

import opensearch_config

VARS = ("OPENSEARCH_USER", "OPENSEARCH_PASSWORD", "OPENSEARCH_VERIFY_CERTS", "OPENSEARCH_CA_CERTS")


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    for name in VARS:
        monkeypatch.delenv(name, raising=False)


def test_defaults_verify_certs_and_send_no_credentials():
    assert opensearch_config.client_kwargs() == {"verify_certs": True}


def test_basic_auth_needs_both_values(monkeypatch):
    monkeypatch.setenv("OPENSEARCH_USER", "reader")
    with pytest.raises(ValueError):
        opensearch_config.client_kwargs()
    monkeypatch.setenv("OPENSEARCH_PASSWORD", "p@ss:word/with?chars")
    assert opensearch_config.client_kwargs()["http_auth"] == ("reader", "p@ss:word/with?chars")


@pytest.mark.parametrize("value", ["false", "False", " FALSE "])
def test_verification_can_be_turned_off(monkeypatch, value):
    monkeypatch.setenv("OPENSEARCH_VERIFY_CERTS", value)
    kwargs = opensearch_config.client_kwargs()
    assert kwargs["verify_certs"] is False
    assert kwargs["ssl_show_warn"] is False


def test_anything_but_false_keeps_verification_on(monkeypatch):
    monkeypatch.setenv("OPENSEARCH_VERIFY_CERTS", "0")  # a typo must not weaken TLS
    assert opensearch_config.client_kwargs()["verify_certs"] is True


def test_ca_bundle_is_passed_through(monkeypatch):
    monkeypatch.setenv("OPENSEARCH_CA_CERTS", "/etc/ssl/dev-ca.pem")
    assert opensearch_config.client_kwargs()["ca_certs"] == "/etc/ssl/dev-ca.pem"


def test_extra_arguments_override(monkeypatch):
    client = opensearch_config.new_client(max_retries=0)
    assert client.transport.max_retries == 0
