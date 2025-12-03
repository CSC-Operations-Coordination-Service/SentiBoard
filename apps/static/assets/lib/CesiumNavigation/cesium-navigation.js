var viewerCesiumNavigationMixin = (function (MarkdownIt,MarkdownItSanitizer,Hammer,Knockout,cesium) {
  'use strict';

  MarkdownIt = MarkdownIt && MarkdownIt.hasOwnProperty('default') ? MarkdownIt['default'] : MarkdownIt;
  MarkdownItSanitizer = MarkdownItSanitizer && MarkdownItSanitizer.hasOwnProperty('default') ? MarkdownItSanitizer['default'] : MarkdownItSanitizer;
  Hammer = Hammer && Hammer.hasOwnProperty('default') ? Hammer['default'] : Hammer;
  Knockout = Knockout && Knockout.hasOwnProperty('default') ? Knockout['default'] : Knockout;

  var htmlTagRegex = /<html(.|\s)*>(.|\s)*<\/html>/im;

  var md = new MarkdownIt({
    html: true,
    linkify: true });


  md.use(MarkdownItSanitizer, {
    imageClass: '',
    removeUnbalanced: false,
    removeUnknown: false });


  var KnockoutMarkdownBinding = {
    register: function register(_knockoutEle) {
      var knockoutEle = _knockoutEle;
      knockoutEle.bindingHandlers.markdown = {
        init: function init() {
          // Prevent binding on the dynamically-injected HTML
          // (as developers are unlikely to expect that, and it has security implications)
          return { controlsDescendantBindings: true };
        },
        update: function update(_element, valueAccessor) {
          var element = _element;
          // Remove existing children of this element.
          while (element.firstChild) {
            knockoutEle.removeNode(element.firstChild);
          }

          var rawText = knockoutEle.unwrap(valueAccessor());

          // If the text contains an <html> tag, don't try to interpret it as Markdown because
          // we'll probably break it in the process.
          var html = void 0;
          if (htmlTagRegex.test(rawText)) {
            html = rawText;
          } else {
            html = md.render(rawText);
          }

          var nodes = knockoutEle.utils.parseHtmlFragment(html, element);
          element.className = element.className + ' markdown';

          for (var i = 0; i < nodes.length; ++i) {
            var node = nodes[i];
            setAnchorTargets(node);
            element.appendChild(node);
          }
        } };

    } };


  function setAnchorTargets(_element) {
    var element = _element;
    if (element instanceof HTMLAnchorElement) {
      element.target = '_blank';
    }

    if (element.childNodes && element.childNodes.length > 0) {
      for (var i = 0; i < element.childNodes.length; ++i) {
        setAnchorTargets(element.childNodes[i]);
      }
    }
  }

  var KnockoutHammerBinding = {
    register: function register() {
      Knockout.bindingHandlers.swipeLeft = {
        init: function init(element, valueAccessor, allBindings, _viewModel, bindingContext) {
          var f = Knockout.unwrap(valueAccessor());
          new Hammer(element).on('swipeleft', function () {for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {args[_key] = arguments[_key];}
            var viewModel = bindingContext.$data;
            f.apply(viewModel, args);
          });
        } };


      Knockout.bindingHandlers.swipeRight = {
        init: function init(element, valueAccessor, allBindings, _viewModel, bindingContext) {
          var f = Knockout.unwrap(valueAccessor());
          new Hammer(element).on('swiperight', function () {for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {args[_key2] = arguments[_key2];}
            var viewModel = bindingContext.$data;
            f.apply(viewModel, args);
          });
        } };

    } };

  function registerKnockoutBindings() {
    cesium.SvgPathBindingHandler.register(Knockout);
    KnockoutMarkdownBinding.register(Knockout);
    KnockoutHammerBinding.register(Knockout);

    Knockout.bindingHandlers.embeddedComponent = {
      init: function init(element, valueAccessor) {
        var component = Knockout.unwrap(valueAccessor());
        component.show(element);
        return { controlsDescendantBindings: true };
      },
      update: function update() {} };

  }

  function createFragmentFromTemplate(htmlString) {
    var holder = document.createElement('div');
    holder.innerHTML = htmlString;

    var fragment = document.createDocumentFragment();
    while (holder.firstChild) {
      fragment.appendChild(holder.firstChild);
    }

    return fragment;
  }

  function loadView(htmlString, _container, viewModel) {
    var container = cesium.getElement(_container);

    var fragment = createFragmentFromTemplate(htmlString);

    // Sadly, fragment.childNodes doesn't have a slice function.
    // This code could be replaced with Array.prototype.slice.call(fragment.childNodes)
    // but that seems slightly error prone.
    var nodes = [];

    for (var i = 0; i < fragment.childNodes.length; ++i) {
      nodes.push(fragment.childNodes[i]);
    }

    container.appendChild(fragment);

    for (var _i = 0; _i < nodes.length; ++_i) {
      var node = nodes[_i];
      if (node.nodeType === 1 || node.nodeType === 8) {
        Knockout.applyBindings(viewModel, node);
      }
    }

    return nodes;
  }

  function unwrapExports (x) {
  	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x.default : x;
  }

  function createCommonjsModule(fn, module) {
  	return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  var helpers = createCommonjsModule(function (module, exports) {
  Object.defineProperty(exports, "__esModule", { value: true });
  /**
   * @module helpers
   */
  /**
   * Earth Radius used with the Harvesine formula and approximates using a spherical (non-ellipsoid) Earth.
   *
   * @memberof helpers
   * @type {number}
   */
  exports.earthRadius = 6371008.8;
  /**
   * Unit of measurement factors using a spherical (non-ellipsoid) earth radius.
   *
   * @memberof helpers
   * @type {Object}
   */
  exports.factors = {
      centimeters: exports.earthRadius * 100,
      centimetres: exports.earthRadius * 100,
      degrees: exports.earthRadius / 111325,
      feet: exports.earthRadius * 3.28084,
      inches: exports.earthRadius * 39.370,
      kilometers: exports.earthRadius / 1000,
      kilometres: exports.earthRadius / 1000,
      meters: exports.earthRadius,
      metres: exports.earthRadius,
      miles: exports.earthRadius / 1609.344,
      millimeters: exports.earthRadius * 1000,
      millimetres: exports.earthRadius * 1000,
      nauticalmiles: exports.earthRadius / 1852,
      radians: 1,
      yards: exports.earthRadius / 1.0936,
  };
  /**
   * Units of measurement factors based on 1 meter.
   *
   * @memberof helpers
   * @type {Object}
   */
  exports.unitsFactors = {
      centimeters: 100,
      centimetres: 100,
      degrees: 1 / 111325,
      feet: 3.28084,
      inches: 39.370,
      kilometers: 1 / 1000,
      kilometres: 1 / 1000,
      meters: 1,
      metres: 1,
      miles: 1 / 1609.344,
      millimeters: 1000,
      millimetres: 1000,
      nauticalmiles: 1 / 1852,
      radians: 1 / exports.earthRadius,
      yards: 1 / 1.0936,
  };
  /**
   * Area of measurement factors based on 1 square meter.
   *
   * @memberof helpers
   * @type {Object}
   */
  exports.areaFactors = {
      acres: 0.000247105,
      centimeters: 10000,
      centimetres: 10000,
      feet: 10.763910417,
      inches: 1550.003100006,
      kilometers: 0.000001,
      kilometres: 0.000001,
      meters: 1,
      metres: 1,
      miles: 3.86e-7,
      millimeters: 1000000,
      millimetres: 1000000,
      yards: 1.195990046,
  };
  /**
   * Wraps a GeoJSON {@link Geometry} in a GeoJSON {@link Feature}.
   *
   * @name feature
   * @param {Geometry} geometry input geometry
   * @param {Object} [properties={}] an Object of key-value pairs to add as properties
   * @param {Object} [options={}] Optional Parameters
   * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
   * @param {string|number} [options.id] Identifier associated with the Feature
   * @returns {Feature} a GeoJSON Feature
   * @example
   * var geometry = {
   *   "type": "Point",
   *   "coordinates": [110, 50]
   * };
   *
   * var feature = turf.feature(geometry);
   *
   * //=feature
   */
  function feature(geom, properties, options) {
      if (options === void 0) { options = {}; }
      var feat = { type: "Feature" };
      if (options.id === 0 || options.id) {
          feat.id = options.id;
      }
      if (options.bbox) {
          feat.bbox = options.bbox;
      }
      feat.properties = properties || {};
      feat.geometry = geom;
      return feat;
  }
  exports.feature = feature;
  /**
   * Creates a GeoJSON {@link Geometry} from a Geometry string type & coordinates.
   * For GeometryCollection type use `helpers.geometryCollection`
   *
   * @name geometry
   * @param {string} type Geometry Type
   * @param {Array<any>} coordinates Coordinates
   * @param {Object} [options={}] Optional Parameters
   * @returns {Geometry} a GeoJSON Geometry
   * @example
   * var type = "Point";
   * var coordinates = [110, 50];
   * var geometry = turf.geometry(type, coordinates);
   * // => geometry
   */
  function geometry(type, coordinates, options) {
      if (options === void 0) { options = {}; }
      switch (type) {
          case "Point": return point(coordinates).geometry;
          case "LineString": return lineString(coordinates).geometry;
          case "Polygon": return polygon(coordinates).geometry;
          case "MultiPoint": return multiPoint(coordinates).geometry;
          case "MultiLineString": return multiLineString(coordinates).geometry;
          case "MultiPolygon": return multiPolygon(coordinates).geometry;
          default: throw new Error(type + " is invalid");
      }
  }
  exports.geometry = geometry;
  /**
   * Creates a {@link Point} {@link Feature} from a Position.
   *
   * @name point
   * @param {Array<number>} coordinates longitude, latitude position (each in decimal degrees)
   * @param {Object} [properties={}] an Object of key-value pairs to add as properties
   * @param {Object} [options={}] Optional Parameters
   * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
   * @param {string|number} [options.id] Identifier associated with the Feature
   * @returns {Feature<Point>} a Point feature
   * @example
   * var point = turf.point([-75.343, 39.984]);
   *
   * //=point
   */
  function point(coordinates, properties, options) {
      if (options === void 0) { options = {}; }
      var geom = {
          type: "Point",
          coordinates: coordinates,
      };
      return feature(geom, properties, options);
  }
  exports.point = point;
  /**
   * Creates a {@link Point} {@link FeatureCollection} from an Array of Point coordinates.
   *
   * @name points
   * @param {Array<Array<number>>} coordinates an array of Points
   * @param {Object} [properties={}] Translate these properties to each Feature
   * @param {Object} [options={}] Optional Parameters
   * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north]
   * associated with the FeatureCollection
   * @param {string|number} [options.id] Identifier associated with the FeatureCollection
   * @returns {FeatureCollection<Point>} Point Feature
   * @example
   * var points = turf.points([
   *   [-75, 39],
   *   [-80, 45],
   *   [-78, 50]
   * ]);
   *
   * //=points
   */
  function points(coordinates, properties, options) {
      if (options === void 0) { options = {}; }
      return featureCollection(coordinates.map(function (coords) {
          return point(coords, properties);
      }), options);
  }
  exports.points = points;
  /**
   * Creates a {@link Polygon} {@link Feature} from an Array of LinearRings.
   *
   * @name polygon
   * @param {Array<Array<Array<number>>>} coordinates an array of LinearRings
   * @param {Object} [properties={}] an Object of key-value pairs to add as properties
   * @param {Object} [options={}] Optional Parameters
   * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
   * @param {string|number} [options.id] Identifier associated with the Feature
   * @returns {Feature<Polygon>} Polygon Feature
   * @example
   * var polygon = turf.polygon([[[-5, 52], [-4, 56], [-2, 51], [-7, 54], [-5, 52]]], { name: 'poly1' });
   *
   * //=polygon
   */
  function polygon(coordinates, properties, options) {
      if (options === void 0) { options = {}; }
      for (var _i = 0, coordinates_1 = coordinates; _i < coordinates_1.length; _i++) {
          var ring = coordinates_1[_i];
          if (ring.length < 4) {
              throw new Error("Each LinearRing of a Polygon must have 4 or more Positions.");
          }
          for (var j = 0; j < ring[ring.length - 1].length; j++) {
              // Check if first point of Polygon contains two numbers
              if (ring[ring.length - 1][j] !== ring[0][j]) {
                  throw new Error("First and last Position are not equivalent.");
              }
          }
      }
      var geom = {
          type: "Polygon",
          coordinates: coordinates,
      };
      return feature(geom, properties, options);
  }
  exports.polygon = polygon;
  /**
   * Creates a {@link Polygon} {@link FeatureCollection} from an Array of Polygon coordinates.
   *
   * @name polygons
   * @param {Array<Array<Array<Array<number>>>>} coordinates an array of Polygon coordinates
   * @param {Object} [properties={}] an Object of key-value pairs to add as properties
   * @param {Object} [options={}] Optional Parameters
   * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
   * @param {string|number} [options.id] Identifier associated with the FeatureCollection
   * @returns {FeatureCollection<Polygon>} Polygon FeatureCollection
   * @example
   * var polygons = turf.polygons([
   *   [[[-5, 52], [-4, 56], [-2, 51], [-7, 54], [-5, 52]]],
   *   [[[-15, 42], [-14, 46], [-12, 41], [-17, 44], [-15, 42]]],
   * ]);
   *
   * //=polygons
   */
  function polygons(coordinates, properties, options) {
      if (options === void 0) { options = {}; }
      return featureCollection(coordinates.map(function (coords) {
          return polygon(coords, properties);
      }), options);
  }
  exports.polygons = polygons;
  /**
   * Creates a {@link LineString} {@link Feature} from an Array of Positions.
   *
   * @name lineString
   * @param {Array<Array<number>>} coordinates an array of Positions
   * @param {Object} [properties={}] an Object of key-value pairs to add as properties
   * @param {Object} [options={}] Optional Parameters
   * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
   * @param {string|number} [options.id] Identifier associated with the Feature
   * @returns {Feature<LineString>} LineString Feature
   * @example
   * var linestring1 = turf.lineString([[-24, 63], [-23, 60], [-25, 65], [-20, 69]], {name: 'line 1'});
   * var linestring2 = turf.lineString([[-14, 43], [-13, 40], [-15, 45], [-10, 49]], {name: 'line 2'});
   *
   * //=linestring1
   * //=linestring2
   */
  function lineString(coordinates, properties, options) {
      if (options === void 0) { options = {}; }
      if (coordinates.length < 2) {
          throw new Error("coordinates must be an array of two or more positions");
      }
      var geom = {
          type: "LineString",
          coordinates: coordinates,
      };
      return feature(geom, properties, options);
  }
  exports.lineString = lineString;
  /**
   * Creates a {@link LineString} {@link FeatureCollection} from an Array of LineString coordinates.
   *
   * @name lineStrings
   * @param {Array<Array<Array<number>>>} coordinates an array of LinearRings
   * @param {Object} [properties={}] an Object of key-value pairs to add as properties
   * @param {Object} [options={}] Optional Parameters
   * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north]
   * associated with the FeatureCollection
   * @param {string|number} [options.id] Identifier associated with the FeatureCollection
   * @returns {FeatureCollection<LineString>} LineString FeatureCollection
   * @example
   * var linestrings = turf.lineStrings([
   *   [[-24, 63], [-23, 60], [-25, 65], [-20, 69]],
   *   [[-14, 43], [-13, 40], [-15, 45], [-10, 49]]
   * ]);
   *
   * //=linestrings
   */
  function lineStrings(coordinates, properties, options) {
      if (options === void 0) { options = {}; }
      return featureCollection(coordinates.map(function (coords) {
          return lineString(coords, properties);
      }), options);
  }
  exports.lineStrings = lineStrings;
  /**
   * Takes one or more {@link Feature|Features} and creates a {@link FeatureCollection}.
   *
   * @name featureCollection
   * @param {Feature[]} features input features
   * @param {Object} [options={}] Optional Parameters
   * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
   * @param {string|number} [options.id] Identifier associated with the Feature
   * @returns {FeatureCollection} FeatureCollection of Features
   * @example
   * var locationA = turf.point([-75.343, 39.984], {name: 'Location A'});
   * var locationB = turf.point([-75.833, 39.284], {name: 'Location B'});
   * var locationC = turf.point([-75.534, 39.123], {name: 'Location C'});
   *
   * var collection = turf.featureCollection([
   *   locationA,
   *   locationB,
   *   locationC
   * ]);
   *
   * //=collection
   */
  function featureCollection(features, options) {
      if (options === void 0) { options = {}; }
      var fc = { type: "FeatureCollection" };
      if (options.id) {
          fc.id = options.id;
      }
      if (options.bbox) {
          fc.bbox = options.bbox;
      }
      fc.features = features;
      return fc;
  }
  exports.featureCollection = featureCollection;
  /**
   * Creates a {@link Feature<MultiLineString>} based on a
   * coordinate array. Properties can be added optionally.
   *
   * @name multiLineString
   * @param {Array<Array<Array<number>>>} coordinates an array of LineStrings
   * @param {Object} [properties={}] an Object of key-value pairs to add as properties
   * @param {Object} [options={}] Optional Parameters
   * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
   * @param {string|number} [options.id] Identifier associated with the Feature
   * @returns {Feature<MultiLineString>} a MultiLineString feature
   * @throws {Error} if no coordinates are passed
   * @example
   * var multiLine = turf.multiLineString([[[0,0],[10,10]]]);
   *
   * //=multiLine
   */
  function multiLineString(coordinates, properties, options) {
      if (options === void 0) { options = {}; }
      var geom = {
          type: "MultiLineString",
          coordinates: coordinates,
      };
      return feature(geom, properties, options);
  }
  exports.multiLineString = multiLineString;
  /**
   * Creates a {@link Feature<MultiPoint>} based on a
   * coordinate array. Properties can be added optionally.
   *
   * @name multiPoint
   * @param {Array<Array<number>>} coordinates an array of Positions
   * @param {Object} [properties={}] an Object of key-value pairs to add as properties
   * @param {Object} [options={}] Optional Parameters
   * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
   * @param {string|number} [options.id] Identifier associated with the Feature
   * @returns {Feature<MultiPoint>} a MultiPoint feature
   * @throws {Error} if no coordinates are passed
   * @example
   * var multiPt = turf.multiPoint([[0,0],[10,10]]);
   *
   * //=multiPt
   */
  function multiPoint(coordinates, properties, options) {
      if (options === void 0) { options = {}; }
      var geom = {
          type: "MultiPoint",
          coordinates: coordinates,
      };
      return feature(geom, properties, options);
  }
  exports.multiPoint = multiPoint;
  /**
   * Creates a {@link Feature<MultiPolygon>} based on a
   * coordinate array. Properties can be added optionally.
   *
   * @name multiPolygon
   * @param {Array<Array<Array<Array<number>>>>} coordinates an array of Polygons
   * @param {Object} [properties={}] an Object of key-value pairs to add as properties
   * @param {Object} [options={}] Optional Parameters
   * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
   * @param {string|number} [options.id] Identifier associated with the Feature
   * @returns {Feature<MultiPolygon>} a multipolygon feature
   * @throws {Error} if no coordinates are passed
   * @example
   * var multiPoly = turf.multiPolygon([[[[0,0],[0,10],[10,10],[10,0],[0,0]]]]);
   *
   * //=multiPoly
   *
   */
  function multiPolygon(coordinates, properties, options) {
      if (options === void 0) { options = {}; }
      var geom = {
          type: "MultiPolygon",
          coordinates: coordinates,
      };
      return feature(geom, properties, options);
  }
  exports.multiPolygon = multiPolygon;
  /**
   * Creates a {@link Feature<GeometryCollection>} based on a
   * coordinate array. Properties can be added optionally.
   *
   * @name geometryCollection
   * @param {Array<Geometry>} geometries an array of GeoJSON Geometries
   * @param {Object} [properties={}] an Object of key-value pairs to add as properties
   * @param {Object} [options={}] Optional Parameters
   * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
   * @param {string|number} [options.id] Identifier associated with the Feature
   * @returns {Feature<GeometryCollection>} a GeoJSON GeometryCollection Feature
   * @example
   * var pt = turf.geometry("Point", [100, 0]);
   * var line = turf.geometry("LineString", [[101, 0], [102, 1]]);
   * var collection = turf.geometryCollection([pt, line]);
   *
   * // => collection
   */
  function geometryCollection(geometries, properties, options) {
      if (options === void 0) { options = {}; }
      var geom = {
          type: "GeometryCollection",
          geometries: geometries,
      };
      return feature(geom, properties, options);
  }
  exports.geometryCollection = geometryCollection;
  /**
   * Round number to precision
   *
   * @param {number} num Number
   * @param {number} [precision=0] Precision
   * @returns {number} rounded number
   * @example
   * turf.round(120.4321)
   * //=120
   *
   * turf.round(120.4321, 2)
   * //=120.43
   */
  function round(num, precision) {
      if (precision === void 0) { precision = 0; }
      if (precision && !(precision >= 0)) {
          throw new Error("precision must be a positive number");
      }
      var multiplier = Math.pow(10, precision || 0);
      return Math.round(num * multiplier) / multiplier;
  }
  exports.round = round;
  /**
   * Convert a distance measurement (assuming a spherical Earth) from radians to a more friendly unit.
   * Valid units: miles, nauticalmiles, inches, yards, meters, metres, kilometers, centimeters, feet
   *
   * @name radiansToLength
   * @param {number} radians in radians across the sphere
   * @param {string} [units="kilometers"] can be degrees, radians, miles, or kilometers inches, yards, metres,
   * meters, kilometres, kilometers.
   * @returns {number} distance
   */
  function radiansToLength(radians, units) {
      if (units === void 0) { units = "kilometers"; }
      var factor = exports.factors[units];
      if (!factor) {
          throw new Error(units + " units is invalid");
      }
      return radians * factor;
  }
  exports.radiansToLength = radiansToLength;
  /**
   * Convert a distance measurement (assuming a spherical Earth) from a real-world unit into radians
   * Valid units: miles, nauticalmiles, inches, yards, meters, metres, kilometers, centimeters, feet
   *
   * @name lengthToRadians
   * @param {number} distance in real units
   * @param {string} [units="kilometers"] can be degrees, radians, miles, or kilometers inches, yards, metres,
   * meters, kilometres, kilometers.
   * @returns {number} radians
   */
  function lengthToRadians(distance, units) {
      if (units === void 0) { units = "kilometers"; }
      var factor = exports.factors[units];
      if (!factor) {
          throw new Error(units + " units is invalid");
      }
      return distance / factor;
  }
  exports.lengthToRadians = lengthToRadians;
  /**
   * Convert a distance measurement (assuming a spherical Earth) from a real-world unit into degrees
   * Valid units: miles, nauticalmiles, inches, yards, meters, metres, centimeters, kilometres, feet
   *
   * @name lengthToDegrees
   * @param {number} distance in real units
   * @param {string} [units="kilometers"] can be degrees, radians, miles, or kilometers inches, yards, metres,
   * meters, kilometres, kilometers.
   * @returns {number} degrees
   */
  function lengthToDegrees(distance, units) {
      return radiansToDegrees(lengthToRadians(distance, units));
  }
  exports.lengthToDegrees = lengthToDegrees;
  /**
   * Converts any bearing angle from the north line direction (positive clockwise)
   * and returns an angle between 0-360 degrees (positive clockwise), 0 being the north line
   *
   * @name bearingToAzimuth
   * @param {number} bearing angle, between -180 and +180 degrees
   * @returns {number} angle between 0 and 360 degrees
   */
  function bearingToAzimuth(bearing) {
      var angle = bearing % 360;
      if (angle < 0) {
          angle += 360;
      }
      return angle;
  }
  exports.bearingToAzimuth = bearingToAzimuth;
  /**
   * Converts an angle in radians to degrees
   *
   * @name radiansToDegrees
   * @param {number} radians angle in radians
   * @returns {number} degrees between 0 and 360 degrees
   */
  function radiansToDegrees(radians) {
      var degrees = radians % (2 * Math.PI);
      return degrees * 180 / Math.PI;
  }
  exports.radiansToDegrees = radiansToDegrees;
  /**
   * Converts an angle in degrees to radians
   *
   * @name degreesToRadians
   * @param {number} degrees angle between 0 and 360 degrees
   * @returns {number} angle in radians
   */
  function degreesToRadians(degrees) {
      var radians = degrees % 360;
      return radians * Math.PI / 180;
  }
  exports.degreesToRadians = degreesToRadians;
  /**
   * Converts a length to the requested unit.
   * Valid units: miles, nauticalmiles, inches, yards, meters, metres, kilometers, centimeters, feet
   *
   * @param {number} length to be converted
   * @param {Units} [originalUnit="kilometers"] of the length
   * @param {Units} [finalUnit="kilometers"] returned unit
   * @returns {number} the converted length
   */
  function convertLength(length, originalUnit, finalUnit) {
      if (originalUnit === void 0) { originalUnit = "kilometers"; }
      if (finalUnit === void 0) { finalUnit = "kilometers"; }
      if (!(length >= 0)) {
          throw new Error("length must be a positive number");
      }
      return radiansToLength(lengthToRadians(length, originalUnit), finalUnit);
  }
  exports.convertLength = convertLength;
  /**
   * Converts a area to the requested unit.
   * Valid units: kilometers, kilometres, meters, metres, centimetres, millimeters, acres, miles, yards, feet, inches
   * @param {number} area to be converted
   * @param {Units} [originalUnit="meters"] of the distance
   * @param {Units} [finalUnit="kilometers"] returned unit
   * @returns {number} the converted distance
   */
  function convertArea(area, originalUnit, finalUnit) {
      if (originalUnit === void 0) { originalUnit = "meters"; }
      if (finalUnit === void 0) { finalUnit = "kilometers"; }
      if (!(area >= 0)) {
          throw new Error("area must be a positive number");
      }
      var startFactor = exports.areaFactors[originalUnit];
      if (!startFactor) {
          throw new Error("invalid original units");
      }
      var finalFactor = exports.areaFactors[finalUnit];
      if (!finalFactor) {
          throw new Error("invalid final units");
      }
      return (area / startFactor) * finalFactor;
  }
  exports.convertArea = convertArea;
  /**
   * isNumber
   *
   * @param {*} num Number to validate
   * @returns {boolean} true/false
   * @example
   * turf.isNumber(123)
   * //=true
   * turf.isNumber('foo')
   * //=false
   */
  function isNumber(num) {
      return !isNaN(num) && num !== null && !Array.isArray(num) && !/^\s*$/.test(num);
  }
  exports.isNumber = isNumber;
  /**
   * isObject
   *
   * @param {*} input variable to validate
   * @returns {boolean} true/false
   * @example
   * turf.isObject({elevation: 10})
   * //=true
   * turf.isObject('foo')
   * //=false
   */
  function isObject(input) {
      return (!!input) && (input.constructor === Object);
  }
  exports.isObject = isObject;
  /**
   * Validate BBox
   *
   * @private
   * @param {Array<number>} bbox BBox to validate
   * @returns {void}
   * @throws Error if BBox is not valid
   * @example
   * validateBBox([-180, -40, 110, 50])
   * //=OK
   * validateBBox([-180, -40])
   * //=Error
   * validateBBox('Foo')
   * //=Error
   * validateBBox(5)
   * //=Error
   * validateBBox(null)
   * //=Error
   * validateBBox(undefined)
   * //=Error
   */
  function validateBBox(bbox) {
      if (!bbox) {
          throw new Error("bbox is required");
      }
      if (!Array.isArray(bbox)) {
          throw new Error("bbox must be an Array");
      }
      if (bbox.length !== 4 && bbox.length !== 6) {
          throw new Error("bbox must be an Array of 4 or 6 numbers");
      }
      bbox.forEach(function (num) {
          if (!isNumber(num)) {
              throw new Error("bbox must only contain numbers");
          }
      });
  }
  exports.validateBBox = validateBBox;
  /**
   * Validate Id
   *
   * @private
   * @param {string|number} id Id to validate
   * @returns {void}
   * @throws Error if Id is not valid
   * @example
   * validateId([-180, -40, 110, 50])
   * //=Error
   * validateId([-180, -40])
   * //=Error
   * validateId('Foo')
   * //=OK
   * validateId(5)
   * //=OK
   * validateId(null)
   * //=Error
   * validateId(undefined)
   * //=Error
   */
  function validateId(id) {
      if (!id) {
          throw new Error("id is required");
      }
      if (["string", "number"].indexOf(typeof id) === -1) {
          throw new Error("id must be a number or a string");
      }
  }
  exports.validateId = validateId;
  // Deprecated methods
  function radians2degrees() {
      throw new Error("method has been renamed to `radiansToDegrees`");
  }
  exports.radians2degrees = radians2degrees;
  function degrees2radians() {
      throw new Error("method has been renamed to `degreesToRadians`");
  }
  exports.degrees2radians = degrees2radians;
  function distanceToDegrees() {
      throw new Error("method has been renamed to `lengthToDegrees`");
  }
  exports.distanceToDegrees = distanceToDegrees;
  function distanceToRadians() {
      throw new Error("method has been renamed to `lengthToRadians`");
  }
  exports.distanceToRadians = distanceToRadians;
  function radiansToDistance() {
      throw new Error("method has been renamed to `radiansToLength`");
  }
  exports.radiansToDistance = radiansToDistance;
  function bearingToAngle() {
      throw new Error("method has been renamed to `bearingToAzimuth`");
  }
  exports.bearingToAngle = bearingToAngle;
  function convertDistance() {
      throw new Error("method has been renamed to `convertLength`");
  }
  exports.convertDistance = convertDistance;
  });

  unwrapExports(helpers);
  var helpers_1 = helpers.earthRadius;
  var helpers_2 = helpers.factors;
  var helpers_3 = helpers.unitsFactors;
  var helpers_4 = helpers.areaFactors;
  var helpers_5 = helpers.feature;
  var helpers_6 = helpers.geometry;
  var helpers_7 = helpers.point;
  var helpers_8 = helpers.points;
  var helpers_9 = helpers.polygon;
  var helpers_10 = helpers.polygons;
  var helpers_11 = helpers.lineString;
  var helpers_12 = helpers.lineStrings;
  var helpers_13 = helpers.featureCollection;
  var helpers_14 = helpers.multiLineString;
  var helpers_15 = helpers.multiPoint;
  var helpers_16 = helpers.multiPolygon;
  var helpers_17 = helpers.geometryCollection;
  var helpers_18 = helpers.round;
  var helpers_19 = helpers.radiansToLength;
  var helpers_20 = helpers.lengthToRadians;
  var helpers_21 = helpers.lengthToDegrees;
  var helpers_22 = helpers.bearingToAzimuth;
  var helpers_23 = helpers.radiansToDegrees;
  var helpers_24 = helpers.degreesToRadians;
  var helpers_25 = helpers.convertLength;
  var helpers_26 = helpers.convertArea;
  var helpers_27 = helpers.isNumber;
  var helpers_28 = helpers.isObject;
  var helpers_29 = helpers.validateBBox;
  var helpers_30 = helpers.validateId;
  var helpers_31 = helpers.radians2degrees;
  var helpers_32 = helpers.degrees2radians;
  var helpers_33 = helpers.distanceToDegrees;
  var helpers_34 = helpers.distanceToRadians;
  var helpers_35 = helpers.radiansToDistance;
  var helpers_36 = helpers.bearingToAngle;
  var helpers_37 = helpers.convertDistance;

  var unprojectedScratch = new cesium.Cartographic();
  var rayScratch = new cesium.Ray();

  /**
                               * gets the focus point of the camera
                               * @param {Viewer|Widget} terria The terria
                               * @param {boolean} inWorldCoordinates true to get the focus in world coordinates,
                               *    otherwise get it in projection-specific map coordinates, in meters.
                               * @param {Cartesian3} [result] The object in which the result will be stored.
                               * @return {Cartesian3} The modified result parameter, a new instance if none
                               *    was provided or undefined if there is no focus point.
                               */
  function getCameraFocus(terria, inWorldCoordinates, _result) {
    var result = _result;var
    scene = terria.scene;var
    camera = scene.camera;

    if (scene.mode === cesium.SceneMode.MORPHING) {
      return undefined;
    }

    if (!cesium.defined(result)) {
      result = new cesium.Cartesian3();
    }

    // TODO bug when tracking: if entity moves the current position
    // should be used and not only the one when starting orbiting/rotating
    // TODO bug when tracking: reset should reset to default view of tracked entity

    if (cesium.defined(terria.trackedEntity)) {
      result = terria.trackedEntity.position.getValue(
      terria.clock.currentTime,
      result);

    } else {
      rayScratch.origin = camera.positionWC;
      rayScratch.direction = camera.directionWC;
      result = scene.globe.pick(rayScratch, scene, result);
    }

    if (!cesium.defined(result)) {
      return undefined;
    }

    if (
    scene.mode === cesium.SceneMode.SCENE2D ||
    scene.mode === cesium.SceneMode.COLUMBUS_VIEW)
    {
      result = camera.worldToCameraCoordinatesPoint(result, result);

      if (inWorldCoordinates) {
        result = scene.globe.ellipsoid.cartographicToCartesian(
        scene.mapProjection.unproject(result, unprojectedScratch),
        result);

      }
    } else {
      if (!inWorldCoordinates) {
        result = camera.worldToCameraCoordinatesPoint(result, result);
      }
    }

    return result;
  }

  var UNITS_TO_ABBREVIATION = {
    meters: 'm',
    millimeters: 'mm',
    centimeters: 'cm',
    kilometers: 'km',
    acres: 'ac',
    miles: 'mi',
    nauticalmiles: 'nm',
    inches: 'inch',
    yards: 'yd',
    feet: 'ft',
    radians: 'rad',
    degrees: 'deg' };


  /**
                       * @param  {Number} length
                       * @param  {TufHelper.Units} units
                       */
  function distanceLabelFormatter(length, units) {
    var fixed = 1;
    if (length < 1) {
      fixed = 2;
      if (units === 'kilometers') {
        /* eslint-disable no-param-reassign */
        units = 'meters';
        length = helpers_25(length, 'kilometers', units);
        /* eslint-enable no-param-reassign */
      }
    }

    return length.toFixed(fixed) + ' ' + UNITS_TO_ABBREVIATION[units];
  }

  /* eslint-disable no-bitwise */

  function DistanceLegendViewModel(options) {
    if (!cesium.defined(options) || !cesium.defined(options.terria)) {
      throw new cesium.DeveloperError('options.terria is required.');
    }

    this.terria = options.terria;
    this._removeSubscription = undefined;
    this._lastLegendUpdate = undefined;
    this.eventHelper = new cesium.EventHelper();

    this.distanceLabel = undefined;
    this.barWidth = undefined;
    this.containerWidth = cesium.defined(options.containerWidth) ? options.containerWidth : 125;

    this.enableDistanceLegend = cesium.defined(options.enableDistanceLegend) ?
    options.enableDistanceLegend :
    true;

    Knockout.track(this, ['distanceLabel', 'barWidth']);

    this.eventHelper.add(
    this.terria.afterWidgetChanged,
    function () {
      if (cesium.defined(this._removeSubscription)) {
        this._removeSubscription();
        this._removeSubscription = undefined;
      }
    },
    this);

    //        this.terria.beforeWidgetChanged.addEventListener(function () {
    //            if (defined(this._removeSubscription)) {
    //                this._removeSubscription();
    //                this._removeSubscription = undefined;
    //            }
    //        }, this);

    var that = this;

    function addUpdateSubscription() {
      if (cesium.defined(that.terria)) {var
        scene = that.terria.scene;
        that._removeSubscription = scene.postRender.addEventListener(function () {
          updateDistanceLegendCesium(this, scene, options);
        }, that);
      }
    }

    addUpdateSubscription();
    this.eventHelper.add(
    this.terria.afterWidgetChanged,
    function () {
      addUpdateSubscription();
    },
    this);

    // this.terria.afterWidgetChanged.addEventListener(function() {
    //    addUpdateSubscription();
    // }, this);
  }

  DistanceLegendViewModel.prototype.destroy = function () {
    this.eventHelper.removeAll();
  };

  DistanceLegendViewModel.prototype.show = function (container) {
    var testing = void 0;
    if (this.enableDistanceLegend) {
      testing =
      '<div class="distance-legend" data-bind="visible: distanceLabel && barWidth">' +
      '<div class="distance-legend-label" data-bind="text: distanceLabel"></div>' +
      '<div class="distance-legend-scale-bar" data-bind="style: { width: barWidth + \'px\', left: (5 + (' + this.containerWidth + ' - barWidth) / 2) + \'px\' }"></div>' +
      '</div>';
    } else {
      testing =
      '<div class="distance-legend"  style="display: none;" data-bind="visible: distanceLabel && barWidth">' +
      '<div class="distance-legend-label"  data-bind="text: distanceLabel"></div>' +
      '<div class="distance-legend-scale-bar"  data-bind="style: { width: barWidth + \'px\', left: (5 + (' + this.containerWidth + ' - barWidth) / 2) + \'px\' }"></div>' +
      '</div>';
    }
    loadView(testing, container, this);
    // loadView(distanceLegendTemplate, container, this);
    // loadView(require('fs').readFileSync(
    //   __dirname + '/../Views/DistanceLegend.html', 'utf8'), container, this);
  };

  DistanceLegendViewModel.create = function (options) {
    var result = new DistanceLegendViewModel(options);
    result.show(options.container);
    return result;
  };

  var geodesic = new cesium.EllipsoidGeodesic();

  var distances = [
  1,
  2,
  3,
  5,
  10,
  20,
  30,
  50,
  100,
  200,
  300,
  500,
  1000,
  2000,
  3000,
  5000,
  10000,
  20000,
  30000,
  50000,
  100000,
  200000,
  300000,
  500000,
  1000000,
  2000000,
  3000000,
  5000000,
  10000000,
  20000000,
  30000000,
  50000000];


  /**
              * @param  {KnockoutViewModel} _viewModel
              * @param  {HtmlElement} scene
              * @param  {Object} options
              * @param  {TufHelper.Units} options.units
              * @param  {(_:Number, _: Units): string => {}} options.distanceLabelFormatter
              */
  function updateDistanceLegendCesium(
  _viewModel,
  scene)




  {var _ref = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},_ref$units = _ref.units,units = _ref$units === undefined ? 'kilometers' : _ref$units,_ref$distanceLabelFor = _ref.distanceLabelFormatter,distanceLabelFormatter$$1 = _ref$distanceLabelFor === undefined ? distanceLabelFormatter : _ref$distanceLabelFor;
    var viewModel = _viewModel;
    if (!viewModel.enableDistanceLegend) {
      viewModel.barWidth = undefined;
      viewModel.distanceLabel = undefined;
      return;
    }
    var now = cesium.getTimestamp();
    if (now < viewModel._lastLegendUpdate + 250) {
      return;
    }

    viewModel._lastLegendUpdate = now;

    // Find the distance between two pixels at the bottom center of the screen.
    var width = scene.canvas.clientWidth;
    var height = scene.canvas.clientHeight;

    var left = scene.camera.getPickRay(
    new cesium.Cartesian2(width / 2 | 0, height - 1));

    var right = scene.camera.getPickRay(
    new cesium.Cartesian2(1 + width / 2 | 0, height - 1));var


    globe = scene.globe;
    var leftPosition = globe.pick(left, scene);
    var rightPosition = globe.pick(right, scene);

    if (!cesium.defined(leftPosition) || !cesium.defined(rightPosition)) {
      viewModel.barWidth = undefined;
      viewModel.distanceLabel = undefined;
      return;
    }

    var leftCartographic = globe.ellipsoid.cartesianToCartographic(
    leftPosition);

    var rightCartographic = globe.ellipsoid.cartesianToCartographic(
    rightPosition);


    geodesic.setEndPoints(leftCartographic, rightCartographic);
    var pixelDistance = geodesic.surfaceDistance;

    // Find the first distance that makes the scale bar less than 100 pixels.
    var maxBarWidth = 100;
    var distance = void 0;
    for (var i = distances.length - 1; !cesium.defined(distance) && i >= 0; --i) {
      if (distances[i] / pixelDistance < maxBarWidth) {
        distance = distances[i];
      }
    }

    if (cesium.defined(distance)) {
      var convertedDistance = helpers_25(distance, 'meters', units);
      var label = distanceLabelFormatter$$1(convertedDistance, units);

      viewModel.barWidth = distance / pixelDistance | 0;
      viewModel.distanceLabel = label;
    } else {
      viewModel.barWidth = undefined;
      viewModel.distanceLabel = undefined;
    }
  }

  /**
                                        * The view-model for a control in the user interface
                                        *
                                        * @alias UserInterfaceControl
                                        * @constructor
                                        * @abstract
                                        *
                                        * @param {Terria} terria The Terria instance.
                                        */
  function UserInterfaceControl(terria) {
    if (!cesium.defined(terria)) {
      throw new cesium.DeveloperError('terria is required');
    }

    this._terria = terria;

    /**
                            * Gets or sets the name of the control which is set as the controls title.
                            * This property is observable.
                            * @type {String}
                            */
    this.name = 'Unnamed Control';

    /**
                                    * Gets or sets the text to be displayed in the UI control.
                                    * This property is observable.
                                    * @type {String}
                                    */
    this.text = undefined;

    /**
                            * Gets or sets the svg icon of the control.  This property is observable.
                            * @type {Object}
                            */
    this.svgIcon = undefined;

    /**
                               * Gets or sets the height of the svg icon.  This property is observable.
                               * @type {Integer}
                               */
    this.svgHeight = undefined;

    /**
                                 * Gets or sets the width of the svg icon.  This property is observable.
                                 * @type {Integer}
                                 */
    this.svgWidth = undefined;

    /**
                                * Gets or sets the CSS class of the control. This property is observable.
                                * @type {String}
                                */
    this.cssClass = undefined;

    /**
                                * Gets or sets the property describing whether or not the control is in the active state.
                                * This property is observable.
                                * @type {Boolean}
                                */
    this.isActive = false;

    Knockout.track(this, [
    'name',
    'svgIcon',
    'svgHeight',
    'svgWidth',
    'cssClass',
    'isActive']);

  }

  Object.defineProperties(UserInterfaceControl.prototype, {
    /**
                                                             * Gets the Terria instance.
                                                             * @memberOf UserInterfaceControl.prototype
                                                             * @type {Terria}
                                                             */
    terria: {
      get: function get() {
        return this._terria;
      } },

    /**
            * Gets a value indicating whether this button has text associated with it.
            * @type {Object}
            */
    hasText: {
      get: function get() {
        return cesium.defined(this.text) && typeof this.text === 'string';
      } } });



  /**
               * When implemented in a derived class, performs an action when the user clicks
               * on this control.
               * @abstract
               * @protected
               */
  UserInterfaceControl.prototype.activate = function () {
    throw new cesium.DeveloperError(
    'activate must be implemented in the derived class.');

  };

  function _classCallCheck(instance, Constructor) {if (!(instance instanceof Constructor)) {throw new TypeError("Cannot call a class as a function");}}function _possibleConstructorReturn(self, call) {if (!self) {throw new ReferenceError("this hasn't been initialised - super() hasn't been called");}return call && (typeof call === "object" || typeof call === "function") ? call : self;}function _inherits(subClass, superClass) {if (typeof superClass !== "function" && superClass !== null) {throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);}subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } });if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;}var

  NavigationControl = function (_UserInterfaceControl) {_inherits(NavigationControl, _UserInterfaceControl);function NavigationControl() {_classCallCheck(this, NavigationControl);return _possibleConstructorReturn(this, (NavigationControl.__proto__ || Object.getPrototypeOf(NavigationControl)).apply(this, arguments));}return NavigationControl;}(UserInterfaceControl);

  var svgReset = 'M 7.5,0 C 3.375,0 0,3.375 0,7.5 0,11.625 3.375,15 7.5,15 c 3.46875,0 6.375,-2.4375 7.21875,-5.625 l -1.96875,0 C 12,11.53125 9.9375,13.125 7.5,13.125 4.40625,13.125 1.875,10.59375 1.875,7.5 1.875,4.40625 4.40625,1.875 7.5,1.875 c 1.59375,0 2.90625,0.65625 3.9375,1.6875 l -3,3 6.5625,0 L 15,0 12.75,2.25 C 11.4375,0.84375 9.5625,0 7.5,0 z';

  /**
                                                * The model for a zoom in control in the navigation control tool bar
                                                *
                                                * @alias ResetViewNavigationControl
                                                * @constructor
                                                * @abstract
                                                *
                                                * @param {Terria} terria The Terria instance.
                                                */
  function ResetViewNavigationControl() {for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {args[_key] = arguments[_key];}
    NavigationControl.apply(this, args);

    /**
                                          * Gets or sets the name of the control which is set as the control's title.
                                          * This property is observable.
                                          * @type {String}
                                          */
    this.name = 'Reset View';
    this.navigationLocked = false;

    /**
                                    * Gets or sets the svg icon of the control.  This property is observable.
                                    * @type {Object}
                                    */
    this.svgIcon = svgReset;

    /**
                              * Gets or sets the height of the svg icon.  This property is observable.
                              * @type {Integer}
                              */
    this.svgHeight = 15;

    /**
                          * Gets or sets the width of the svg icon.  This property is observable.
                          * @type {Integer}
                          */
    this.svgWidth = 15;

    /**
                         * Gets or sets the CSS class of the control. This property is observable.
                         * @type {String}
                         */
    this.cssClass = 'navigation-control-icon-reset';
  }

  ResetViewNavigationControl.prototype = Object.create(
  NavigationControl.prototype);


  ResetViewNavigationControl.prototype.setNavigationLocked = function (locked) {
    this.navigationLocked = locked;
  };

  ResetViewNavigationControl.prototype.resetView = function () {
    // this.terria.analytics.logEvent('navigation', 'click', 'reset');
    if (this.navigationLocked) {
      return;
    }var
    scene = this.terria.scene;

    var sscc = scene.screenSpaceCameraController;
    if (!sscc.enableInputs) {
      return;
    }

    this.isActive = true;var

    camera = scene.camera;

    if (cesium.defined(this.terria.trackedEntity)) {
      // when tracking do not reset to default view but to default view of tracked entity
      var trackedEntity = this.terria.trackedEntity;
      this.terria.trackedEntity = undefined;
      this.terria.trackedEntity = trackedEntity;
    } else {
      // reset to a default position or view defined in the options
      if (this.terria.options.defaultResetView) {
        if (
        this.terria.options.defaultResetView &&
        //this.terria.options.defaultResetView instanceof Cartographic
        this.terria.options.defaultResetView.constructor.name === cesium.Cartographic.name)
        {
          camera.flyTo({
            destination: scene.globe.ellipsoid.cartographicToCartesian(
            this.terria.options.defaultResetView) });


        } else if (
        this.terria.options.defaultResetView &&
        //this.terria.options.defaultResetView instanceof Rectangle
        this.terria.options.defaultResetView.constructor.name === cesium.Rectangle.name)
        {
          try {
            cesium.Rectangle.validate(this.terria.options.defaultResetView);
            camera.flyTo({
              destination: this.terria.options.defaultResetView });

          } catch (e) {
            console.warn(
            'Cesium-navigation/ResetViewNavigationControl:   options.defaultResetView Cesium rectangle is  invalid!');

          }
        }
      } else if (typeof camera.flyHome === 'function') {
        camera.flyHome(1);
      } else {
        camera.flyTo({
          destination: cesium.Camera.DEFAULT_VIEW_RECTANGLE,
          duration: 1 });

      }
    }
    this.isActive = false;
  };

  /**
      * When implemented in a derived class, performs an action when the user clicks
      * on this control
      * @abstract
      * @protected
      */
  ResetViewNavigationControl.prototype.activate = function () {
    this.resetView();
  };

  /**
                                           * The model for a zoom in control in the navigation control tool bar
                                           *
                                           * @alias ZoomOutNavigationControl
                                           * @constructor
                                           * @abstract
                                           *
                                           * @param {Terria} terria The Terria instance.
                                           * @param {boolean} zoomIn is used for zooming in (true) or out (false)
                                           */
  function ZoomNavigationControl() {for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {args[_key] = arguments[_key];}
    var zoomIn = args[1];
    NavigationControl.apply(this, args);

    /**
                                          * Gets or sets the name of the control which is set as the control's title.
                                          * This property is observable.
                                          * @type {String}
                                          */
    this.name = 'Zoom ' + (zoomIn ? 'In' : 'Out');

    /**
                                                    * Gets or sets the text to be displayed in the nav control. Controls that
                                                    * have text do not display the svgIcon.
                                                    * This property is observable.
                                                    * @type {String}
                                                    */
    this.text = zoomIn ? '+' : '-';

    /**
                                     * Gets or sets the CSS class of the control. This property is observable.
                                     * @type {String}
                                     */
    this.cssClass = 'navigation-control-icon-zoom-' + (zoomIn ? 'in' : 'out');

    this.relativeAmount = 2;

    if (zoomIn) {
      // this ensures that zooming in is the inverse of zooming out and vice versa
      // e.g. the camera position remains when zooming in and out
      this.relativeAmount = 1 / this.relativeAmount;
    }
  }

  ZoomNavigationControl.prototype.relativeAmount = 1;

  ZoomNavigationControl.prototype = Object.create(NavigationControl.prototype);

  /**
                                                                                 * When implemented in a derived class, performs an action when the user clicks
                                                                                 * on this control
                                                                                 * @abstract
                                                                                 * @protected
                                                                                 */
  ZoomNavigationControl.prototype.activate = function () {
    this.zoom(this.relativeAmount);
  };

  var cartesian3Scratch = new cesium.Cartesian3();

  ZoomNavigationControl.prototype.zoom = function (relativeAmount) {
    // this.terria.analytics.logEvent('navigation', 'click', 'zoomIn');

    this.isActive = true;

    if (cesium.defined(this.terria)) {var
      scene = this.terria.scene;

      var sscc = scene.screenSpaceCameraController;
      // do not zoom if it is disabled
      if (!sscc.enableInputs || !sscc.enableZoom) {
        return;
      }
      // TODO
      //            if(scene.mode == SceneMode.COLUMBUS_VIEW && !sscc.enableTranslate) {
      //                return;
      //            }
      var
      camera = scene.camera;
      var orientation = void 0;

      switch (scene.mode) {
        case cesium.SceneMode.MORPHING:
          break;
        case cesium.SceneMode.SCENE2D:
          camera.zoomIn(
          camera.positionCartographic.height * (1 - this.relativeAmount));

          break;
        default:{
            var focus = void 0;

            if (cesium.defined(this.terria.trackedEntity)) {
              focus = new cesium.Cartesian3();
            } else {
              focus = getCameraFocus(this.terria, false);
            }

            if (!cesium.defined(focus)) {
              // Camera direction is not pointing at the globe, so use the ellipsoid horizon point as
              // the focal point.
              var ray = new cesium.Ray(
              camera.worldToCameraCoordinatesPoint(
              scene.globe.ellipsoid.cartographicToCartesian(
              camera.positionCartographic)),


              camera.directionWC);

              focus = cesium.IntersectionTests.grazingAltitudeLocation(
              ray,
              scene.globe.ellipsoid);


              orientation = {
                heading: camera.heading,
                pitch: camera.pitch,
                roll: camera.roll };

            } else {
              orientation = {
                direction: camera.direction,
                up: camera.up };

            }

            var direction = cesium.Cartesian3.subtract(
            camera.position,
            focus,
            cartesian3Scratch);

            var movementVector = cesium.Cartesian3.multiplyByScalar(
            direction,
            relativeAmount,
            direction);

            var endPosition = cesium.Cartesian3.add(focus, movementVector, focus);

            if (
            cesium.defined(this.terria.trackedEntity) ||
            scene.mode === cesium.SceneMode.COLUMBUS_VIEW)
            {
              // sometimes flyTo does not work (jumps to wrong position)
              // so just set the position without any animation
              // do not use flyTo when tracking an entity because
              // during animation the position of the entity may change
              camera.position = endPosition;
            } else {
              camera.flyTo({
                destination: endPosition,
                orientation: orientation,
                duration: 0.5,
                convert: false });

            }
          }}

    }

    // this.terria.notifyRepaintRequired();
    this.isActive = false;
  };

  var svgCompassOuterRing = 'm 66.5625,0 0,15.15625 3.71875,0 0,-10.40625 5.5,10.40625 4.375,0 0,-15.15625 -3.71875,0 0,10.40625 L 70.9375,0 66.5625,0 z M 72.5,20.21875 c -28.867432,0 -52.28125,23.407738 -52.28125,52.28125 0,28.87351 23.413818,52.3125 52.28125,52.3125 28.86743,0 52.28125,-23.43899 52.28125,-52.3125 0,-28.873512 -23.41382,-52.28125 -52.28125,-52.28125 z m 0,1.75 c 13.842515,0 26.368948,5.558092 35.5,14.5625 l -11.03125,11 0.625,0.625 11.03125,-11 c 8.9199,9.108762 14.4375,21.579143 14.4375,35.34375 0,13.764606 -5.5176,26.22729 -14.4375,35.34375 l -11.03125,-11 -0.625,0.625 11.03125,11 c -9.130866,9.01087 -21.658601,14.59375 -35.5,14.59375 -13.801622,0 -26.321058,-5.53481 -35.4375,-14.5 l 11.125,-11.09375 c 6.277989,6.12179 14.857796,9.90625 24.3125,9.90625 19.241896,0 34.875,-15.629154 34.875,-34.875 0,-19.245847 -15.633104,-34.84375 -34.875,-34.84375 -9.454704,0 -18.034511,3.760884 -24.3125,9.875 L 37.0625,36.4375 C 46.179178,27.478444 58.696991,21.96875 72.5,21.96875 z m -0.875,0.84375 0,13.9375 1.75,0 0,-13.9375 -1.75,0 z M 36.46875,37.0625 47.5625,48.15625 C 41.429794,54.436565 37.65625,63.027539 37.65625,72.5 c 0,9.472461 3.773544,18.055746 9.90625,24.34375 L 36.46875,107.9375 c -8.96721,-9.1247 -14.5,-21.624886 -14.5,-35.4375 0,-13.812615 5.53279,-26.320526 14.5,-35.4375 z M 72.5,39.40625 c 18.297686,0 33.125,14.791695 33.125,33.09375 0,18.302054 -14.827314,33.125 -33.125,33.125 -18.297687,0 -33.09375,-14.822946 -33.09375,-33.125 0,-18.302056 14.796063,-33.09375 33.09375,-33.09375 z M 22.84375,71.625 l 0,1.75 13.96875,0 0,-1.75 -13.96875,0 z m 85.5625,0 0,1.75 14,0 0,-1.75 -14,0 z M 71.75,108.25 l 0,13.9375 1.71875,0 0,-13.9375 -1.71875,0 z';

  var svgCompassGyro = 'm 72.71875,54.375 c -0.476702,0 -0.908208,0.245402 -1.21875,0.5625 -0.310542,0.317098 -0.551189,0.701933 -0.78125,1.1875 -0.172018,0.363062 -0.319101,0.791709 -0.46875,1.25 -6.91615,1.075544 -12.313231,6.656514 -13,13.625 -0.327516,0.117495 -0.661877,0.244642 -0.9375,0.375 -0.485434,0.22959 -0.901634,0.471239 -1.21875,0.78125 -0.317116,0.310011 -0.5625,0.742111 -0.5625,1.21875 l 0.03125,0 c 0,0.476639 0.245384,0.877489 0.5625,1.1875 0.317116,0.310011 0.702066,0.58291 1.1875,0.8125 0.35554,0.168155 0.771616,0.32165 1.21875,0.46875 1.370803,6.10004 6.420817,10.834127 12.71875,11.8125 0.146999,0.447079 0.30025,0.863113 0.46875,1.21875 0.230061,0.485567 0.470708,0.870402 0.78125,1.1875 0.310542,0.317098 0.742048,0.5625 1.21875,0.5625 0.476702,0 0.876958,-0.245402 1.1875,-0.5625 0.310542,-0.317098 0.582439,-0.701933 0.8125,-1.1875 0.172018,-0.363062 0.319101,-0.791709 0.46875,-1.25 6.249045,-1.017063 11.256351,-5.7184 12.625,-11.78125 0.447134,-0.1471 0.86321,-0.300595 1.21875,-0.46875 0.485434,-0.22959 0.901633,-0.502489 1.21875,-0.8125 0.317117,-0.310011 0.5625,-0.710861 0.5625,-1.1875 l -0.03125,0 c 0,-0.476639 -0.245383,-0.908739 -0.5625,-1.21875 C 89.901633,71.846239 89.516684,71.60459 89.03125,71.375 88.755626,71.244642 88.456123,71.117495 88.125,71 87.439949,64.078341 82.072807,58.503735 75.21875,57.375 c -0.15044,-0.461669 -0.326927,-0.884711 -0.5,-1.25 -0.230061,-0.485567 -0.501958,-0.870402 -0.8125,-1.1875 -0.310542,-0.317098 -0.710798,-0.5625 -1.1875,-0.5625 z m -0.0625,1.40625 c 0.03595,-0.01283 0.05968,0 0.0625,0 0.0056,0 0.04321,-0.02233 0.1875,0.125 0.144288,0.147334 0.34336,0.447188 0.53125,0.84375 0.06385,0.134761 0.123901,0.309578 0.1875,0.46875 -0.320353,-0.01957 -0.643524,-0.0625 -0.96875,-0.0625 -0.289073,0 -0.558569,0.04702 -0.84375,0.0625 C 71.8761,57.059578 71.936151,56.884761 72,56.75 c 0.18789,-0.396562 0.355712,-0.696416 0.5,-0.84375 0.07214,-0.07367 0.120304,-0.112167 0.15625,-0.125 z m 0,2.40625 c 0.448007,0 0.906196,0.05436 1.34375,0.09375 0.177011,0.592256 0.347655,1.271044 0.5,2.03125 0.475097,2.370753 0.807525,5.463852 0.9375,8.9375 -0.906869,-0.02852 -1.834463,-0.0625 -2.78125,-0.0625 -0.92298,0 -1.802327,0.03537 -2.6875,0.0625 0.138529,-3.473648 0.493653,-6.566747 0.96875,-8.9375 0.154684,-0.771878 0.320019,-1.463985 0.5,-2.0625 0.405568,-0.03377 0.804291,-0.0625 1.21875,-0.0625 z m -2.71875,0.28125 c -0.129732,0.498888 -0.259782,0.987558 -0.375,1.5625 -0.498513,2.487595 -0.838088,5.693299 -0.96875,9.25 -3.21363,0.15162 -6.119596,0.480068 -8.40625,0.9375 -0.682394,0.136509 -1.275579,0.279657 -1.84375,0.4375 0.799068,-6.135482 5.504716,-11.036454 11.59375,-12.1875 z M 75.5,58.5 c 6.043169,1.18408 10.705093,6.052712 11.5,12.15625 -0.569435,-0.155806 -1.200273,-0.302525 -1.875,-0.4375 -2.262525,-0.452605 -5.108535,-0.783809 -8.28125,-0.9375 -0.130662,-3.556701 -0.470237,-6.762405 -0.96875,-9.25 C 75.761959,59.467174 75.626981,58.990925 75.5,58.5 z m -2.84375,12.09375 c 0.959338,0 1.895843,0.03282 2.8125,0.0625 C 75.48165,71.267751 75.5,71.871028 75.5,72.5 c 0,1.228616 -0.01449,2.438313 -0.0625,3.59375 -0.897358,0.0284 -1.811972,0.0625 -2.75,0.0625 -0.927373,0 -1.831062,-0.03473 -2.71875,-0.0625 -0.05109,-1.155437 -0.0625,-2.365134 -0.0625,-3.59375 0,-0.628972 0.01741,-1.232249 0.03125,-1.84375 0.895269,-0.02827 1.783025,-0.0625 2.71875,-0.0625 z M 68.5625,70.6875 c -0.01243,0.60601 -0.03125,1.189946 -0.03125,1.8125 0,1.22431 0.01541,2.407837 0.0625,3.5625 -3.125243,-0.150329 -5.92077,-0.471558 -8.09375,-0.90625 -0.784983,-0.157031 -1.511491,-0.316471 -2.125,-0.5 -0.107878,-0.704096 -0.1875,-1.422089 -0.1875,-2.15625 0,-0.115714 0.02849,-0.228688 0.03125,-0.34375 0.643106,-0.20284 1.389577,-0.390377 2.25,-0.5625 2.166953,-0.433487 4.97905,-0.75541 8.09375,-0.90625 z m 8.3125,0.03125 c 3.075121,0.15271 5.824455,0.446046 7.96875,0.875 0.857478,0.171534 1.630962,0.360416 2.28125,0.5625 0.0027,0.114659 0,0.228443 0,0.34375 0,0.735827 -0.07914,1.450633 -0.1875,2.15625 -0.598568,0.180148 -1.29077,0.34562 -2.0625,0.5 -2.158064,0.431708 -4.932088,0.754666 -8.03125,0.90625 0.04709,-1.154663 0.0625,-2.33819 0.0625,-3.5625 0,-0.611824 -0.01924,-1.185379 -0.03125,-1.78125 z M 57.15625,72.5625 c 0.0023,0.572772 0.06082,1.131112 0.125,1.6875 -0.125327,-0.05123 -0.266577,-0.10497 -0.375,-0.15625 -0.396499,-0.187528 -0.665288,-0.387337 -0.8125,-0.53125 -0.147212,-0.143913 -0.15625,-0.182756 -0.15625,-0.1875 0,-0.0047 -0.02221,-0.07484 0.125,-0.21875 0.147212,-0.143913 0.447251,-0.312472 0.84375,-0.5 0.07123,-0.03369 0.171867,-0.06006 0.25,-0.09375 z m 31.03125,0 c 0.08201,0.03503 0.175941,0.05872 0.25,0.09375 0.396499,0.187528 0.665288,0.356087 0.8125,0.5 0.14725,0.14391 0.15625,0.21405 0.15625,0.21875 0,0.0047 -0.009,0.04359 -0.15625,0.1875 -0.147212,0.143913 -0.416001,0.343722 -0.8125,0.53125 -0.09755,0.04613 -0.233314,0.07889 -0.34375,0.125 0.06214,-0.546289 0.09144,-1.094215 0.09375,-1.65625 z m -29.5,3.625 c 0.479308,0.123125 0.983064,0.234089 1.53125,0.34375 2.301781,0.460458 5.229421,0.787224 8.46875,0.9375 0.167006,2.84339 0.46081,5.433176 0.875,7.5 0.115218,0.574942 0.245268,1.063612 0.375,1.5625 -5.463677,-1.028179 -9.833074,-5.091831 -11.25,-10.34375 z m 27.96875,0 C 85.247546,81.408945 80.919274,85.442932 75.5,86.5 c 0.126981,-0.490925 0.261959,-0.967174 0.375,-1.53125 0.41419,-2.066824 0.707994,-4.65661 0.875,-7.5 3.204493,-0.15162 6.088346,-0.480068 8.375,-0.9375 0.548186,-0.109661 1.051942,-0.220625 1.53125,-0.34375 z M 70.0625,77.53125 c 0.865391,0.02589 1.723666,0.03125 2.625,0.03125 0.912062,0 1.782843,-0.0048 2.65625,-0.03125 -0.165173,2.736408 -0.453252,5.207651 -0.84375,7.15625 -0.152345,0.760206 -0.322989,1.438994 -0.5,2.03125 -0.437447,0.03919 -0.895856,0.0625 -1.34375,0.0625 -0.414943,0 -0.812719,-0.02881 -1.21875,-0.0625 -0.177011,-0.592256 -0.347655,-1.271044 -0.5,-2.03125 -0.390498,-1.948599 -0.700644,-4.419842 -0.875,-7.15625 z m 1.75,10.28125 c 0.284911,0.01545 0.554954,0.03125 0.84375,0.03125 0.325029,0 0.648588,-0.01171 0.96875,-0.03125 -0.05999,0.148763 -0.127309,0.31046 -0.1875,0.4375 -0.18789,0.396562 -0.386962,0.696416 -0.53125,0.84375 -0.144288,0.147334 -0.181857,0.125 -0.1875,0.125 -0.0056,0 -0.07446,0.02233 -0.21875,-0.125 C 72.355712,88.946416 72.18789,88.646562 72,88.25 71.939809,88.12296 71.872486,87.961263 71.8125,87.8125 z';

  var svgCompassRotationMarker = 'M 72.46875,22.03125 C 59.505873,22.050338 46.521615,27.004287 36.6875,36.875 L 47.84375,47.96875 C 61.521556,34.240041 83.442603,34.227389 97.125,47.90625 l 11.125,-11.125 C 98.401629,26.935424 85.431627,22.012162 72.46875,22.03125 z';

  function NavigationViewModel(options) {
    this.terria = options.terria;
    this.eventHelper = new cesium.EventHelper();
    this.enableZoomControls = cesium.defined(options.enableZoomControls) ?
    options.enableZoomControls :
    true;
    this.enableCompass = cesium.defined(options.enableCompass) ?
    options.enableCompass :
    true;
    this.navigationLocked = false;

    // if (this.showZoomControls)
    //   {
    this.controls = options.controls;
    if (!cesium.defined(this.controls)) {
      this.controls = [
      new ZoomNavigationControl(this.terria, true),
      new ResetViewNavigationControl(this.terria),
      new ZoomNavigationControl(this.terria, false)];

    }
    // }

    this.svgCompassOuterRing = svgCompassOuterRing;
    this.svgCompassGyro = svgCompassGyro;
    this.svgCompassRotationMarker = svgCompassRotationMarker;

    this.showCompass = cesium.defined(this.terria) && this.enableCompass;
    this.heading = this.showCompass ? this.terria.scene.camera.heading : 0.0;

    this.isOrbiting = false;
    this.orbitCursorAngle = 0;
    this.orbitCursorOpacity = 0.0;
    this.orbitLastTimestamp = 0;
    this.orbitFrame = undefined;
    this.orbitIsLook = false;
    this.orbitMouseMoveFunction = undefined;
    this.orbitMouseUpFunction = undefined;

    this.isRotating = false;
    this.rotateInitialCursorAngle = undefined;
    this.rotateFrame = undefined;
    this.rotateIsLook = false;
    this.rotateMouseMoveFunction = undefined;
    this.rotateMouseUpFunction = undefined;

    this._unsubcribeFromPostRender = undefined;

    Knockout.track(this, [
    'controls',
    'showCompass',
    'heading',
    'isOrbiting',
    'orbitCursorAngle',
    'isRotating']);


    var that = this;

    NavigationViewModel.prototype.setNavigationLocked = function (locked) {
      this.navigationLocked = locked;
      if (this.controls && this.controls.length > 1) {
        this.controls[1].setNavigationLocked(this.navigationLocked);
      }
    };

    function widgetChange() {
      if (cesium.defined(that.terria)) {
        if (that._unsubcribeFromPostRender) {
          that._unsubcribeFromPostRender();
          that._unsubcribeFromPostRender = undefined;
        }

        that.showCompass = that.enableCompass;

        that._unsubcribeFromPostRender = that.terria.scene.postRender.addEventListener(
        function () {
          that.heading = that.terria.scene.camera.heading;
        });

      } else {
        if (that._unsubcribeFromPostRender) {
          that._unsubcribeFromPostRender();
          that._unsubcribeFromPostRender = undefined;
        }
        that.showCompass = false;
      }
    }

    this.eventHelper.add(this.terria.afterWidgetChanged, widgetChange, this);
    // this.terria.afterWidgetChanged.addEventListener(widgetChange);

    widgetChange();
  }

  NavigationViewModel.prototype.destroy = function () {
    this.eventHelper.removeAll();

    // loadView(require('fs').readFileSync(baseURLEmpCesium
    // + 'js-lib/terrajs/lib/Views/Navigation.html', 'utf8'), container, this);
  };

  NavigationViewModel.prototype.show = function (container) {
    var testing = void 0;
    if (this.enableZoomControls && this.enableCompass) {
      testing =
      '<div class="compass" title="Drag outer ring: rotate view. ' +
      'Drag inner gyroscope: free orbit.' +
      'Double-click: reset view.' +
      'TIP: You can also free orbit by holding the CTRL key and dragging the map." data-bind="visible: showCompass, event: { mousedown: handleMouseDown, dblclick: handleDoubleClick }">' +
      '<div class="compass-outer-ring-background"></div>' +
      " <div class=\"compass-rotation-marker\" data-bind=\"visible: isOrbiting, style: { transform: 'rotate(-' + orbitCursorAngle + 'rad)', '-webkit-transform': 'rotate(-' + orbitCursorAngle + 'rad)', opacity: orbitCursorOpacity }, cesiumSvgPath: { path: svgCompassRotationMarker, width: 145, height: 145 }\"></div>" +
      " <div class=\"compass-outer-ring\" title=\"Click and drag to rotate the camera\" data-bind=\"style: { transform: 'rotate(-' + heading + 'rad)', '-webkit-transform': 'rotate(-' + heading + 'rad)' }, cesiumSvgPath: { path: svgCompassOuterRing, width: 145, height: 145 }\"></div>" +
      ' <div class="compass-gyro-background"></div>' +
      ' <div class="compass-gyro" data-bind="cesiumSvgPath: { path: svgCompassGyro, width: 145, height: 145 }, css: { \'compass-gyro-active\': isOrbiting }"></div>' +
      '</div>' +
      '<div class="navigation-controls">' +
      '<!-- ko foreach: controls -->' +
      "<div data-bind=\"click: activate, attr: { title: $data.name }, css: $root.isLastControl($data) ? 'navigation-control-last' : 'navigation-control' \">" +
      '   <!-- ko if: $data.hasText -->' +
      '   <div data-bind="text: $data.text, css: $data.isActive ?  \'navigation-control-icon-active \' + $data.cssClass : $data.cssClass"></div>' +
      '   <!-- /ko -->' +
      '  <!-- ko ifnot: $data.hasText -->' +
      '  <div data-bind="cesiumSvgPath: { path: $data.svgIcon, width: $data.svgWidth, height: $data.svgHeight }, css: $data.isActive ?  \'navigation-control-icon-active \' + $data.cssClass : $data.cssClass"></div>' +
      '  <!-- /ko -->' +
      ' </div>' +
      ' <!-- /ko -->' +
      '</div>';
    } else if (!this.enableZoomControls && this.enableCompass) {
      testing =
      '<div class="compass" title="Drag outer ring: rotate view. ' +
      'Drag inner gyroscope: free orbit.' +
      'Double-click: reset view.' +
      'TIP: You can also free orbit by holding the CTRL key and dragging the map." data-bind="visible: showCompass, event: { mousedown: handleMouseDown, dblclick: handleDoubleClick }">' +
      '<div class="compass-outer-ring-background"></div>' +
      " <div class=\"compass-rotation-marker\" data-bind=\"visible: isOrbiting, style: { transform: 'rotate(-' + orbitCursorAngle + 'rad)', '-webkit-transform': 'rotate(-' + orbitCursorAngle + 'rad)', opacity: orbitCursorOpacity }, cesiumSvgPath: { path: svgCompassRotationMarker, width: 145, height: 145 }\"></div>" +
      " <div class=\"compass-outer-ring\" title=\"Click and drag to rotate the camera\" data-bind=\"style: { transform: 'rotate(-' + heading + 'rad)', '-webkit-transform': 'rotate(-' + heading + 'rad)' }, cesiumSvgPath: { path: svgCompassOuterRing, width: 145, height: 145 }\"></div>" +
      ' <div class="compass-gyro-background"></div>' +
      ' <div class="compass-gyro" data-bind="cesiumSvgPath: { path: svgCompassGyro, width: 145, height: 145 }, css: { \'compass-gyro-active\': isOrbiting }"></div>' +
      '</div>' +
      '<div class="navigation-controls"  style="display: none;" >' +
      '<!-- ko foreach: controls -->' +
      "<div data-bind=\"click: activate, attr: { title: $data.name }, css: $root.isLastControl($data) ? 'navigation-control-last' : 'navigation-control' \">" +
      '   <!-- ko if: $data.hasText -->' +
      '   <div data-bind="text: $data.text, css: $data.isActive ?  \'navigation-control-icon-active \' + $data.cssClass : $data.cssClass"></div>' +
      '   <!-- /ko -->' +
      '  <!-- ko ifnot: $data.hasText -->' +
      '  <div data-bind="cesiumSvgPath: { path: $data.svgIcon, width: $data.svgWidth, height: $data.svgHeight }, css: $data.isActive ?  \'navigation-control-icon-active \' + $data.cssClass : $data.cssClass"></div>' +
      '  <!-- /ko -->' +
      ' </div>' +
      ' <!-- /ko -->' +
      '</div>';
    } else if (this.enableZoomControls && !this.enableCompass) {
      testing =
      '<div class="compass"  style="display: none;" title="Drag outer ring: rotate view. ' +
      'Drag inner gyroscope: free orbit.' +
      'Double-click: reset view.' +
      'TIP: You can also free orbit by holding the CTRL key and dragging the map." data-bind="visible: showCompass, event: { mousedown: handleMouseDown, dblclick: handleDoubleClick }">' +
      '<div class="compass-outer-ring-background"></div>' +
      " <div class=\"compass-rotation-marker\" data-bind=\"visible: isOrbiting, style: { transform: 'rotate(-' + orbitCursorAngle + 'rad)', '-webkit-transform': 'rotate(-' + orbitCursorAngle + 'rad)', opacity: orbitCursorOpacity }, cesiumSvgPath: { path: svgCompassRotationMarker, width: 145, height: 145 }\"></div>" +
      " <div class=\"compass-outer-ring\" title=\"Click and drag to rotate the camera\" data-bind=\"style: { transform: 'rotate(-' + heading + 'rad)', '-webkit-transform': 'rotate(-' + heading + 'rad)' }, cesiumSvgPath: { path: svgCompassOuterRing, width: 145, height: 145 }\"></div>" +
      ' <div class="compass-gyro-background"></div>' +
      ' <div class="compass-gyro" data-bind="cesiumSvgPath: { path: svgCompassGyro, width: 145, height: 145 }, css: { \'compass-gyro-active\': isOrbiting }"></div>' +
      '</div>' +
      '<div class="navigation-controls"    >' +
      '<!-- ko foreach: controls -->' +
      "<div data-bind=\"click: activate, attr: { title: $data.name }, css: $root.isLastControl($data) ? 'navigation-control-last' : 'navigation-control' \">" +
      '   <!-- ko if: $data.hasText -->' +
      '   <div data-bind="text: $data.text, css: $data.isActive ?  \'navigation-control-icon-active \' + $data.cssClass : $data.cssClass"></div>' +
      '   <!-- /ko -->' +
      '  <!-- ko ifnot: $data.hasText -->' +
      '  <div data-bind="cesiumSvgPath: { path: $data.svgIcon, width: $data.svgWidth, height: $data.svgHeight }, css: $data.isActive ?  \'navigation-control-icon-active \' + $data.cssClass : $data.cssClass"></div>' +
      '  <!-- /ko -->' +
      ' </div>' +
      ' <!-- /ko -->' +
      '</div>';
    } else if (!this.enableZoomControls && !this.enableCompass) {
      testing =
      '<div class="compass"  style="display: none;" title="Drag outer ring: rotate view. ' +
      'Drag inner gyroscope: free orbit.' +
      'Double-click: reset view.' +
      'TIP: You can also free orbit by holding the CTRL key and dragging the map." data-bind="visible: showCompass, event: { mousedown: handleMouseDown, dblclick: handleDoubleClick }">' +
      '<div class="compass-outer-ring-background"></div>' +
      " <div class=\"compass-rotation-marker\" data-bind=\"visible: isOrbiting, style: { transform: 'rotate(-' + orbitCursorAngle + 'rad)', '-webkit-transform': 'rotate(-' + orbitCursorAngle + 'rad)', opacity: orbitCursorOpacity }, cesiumSvgPath: { path: svgCompassRotationMarker, width: 145, height: 145 }\"></div>" +
      " <div class=\"compass-outer-ring\" title=\"Click and drag to rotate the camera\" data-bind=\"style: { transform: 'rotate(-' + heading + 'rad)', '-webkit-transform': 'rotate(-' + heading + 'rad)' }, cesiumSvgPath: { path: svgCompassOuterRing, width: 145, height: 145 }\"></div>" +
      ' <div class="compass-gyro-background"></div>' +
      ' <div class="compass-gyro" data-bind="cesiumSvgPath: { path: svgCompassGyro, width: 145, height: 145 }, css: { \'compass-gyro-active\': isOrbiting }"></div>' +
      '</div>' +
      '<div class="navigation-controls"   style="display: none;" >' +
      '<!-- ko foreach: controls -->' +
      "<div data-bind=\"click: activate, attr: { title: $data.name }, css: $root.isLastControl($data) ? 'navigation-control-last' : 'navigation-control' \">" +
      '   <!-- ko if: $data.hasText -->' +
      '   <div data-bind="text: $data.text, css: $data.isActive ?  \'navigation-control-icon-active \' + $data.cssClass : $data.cssClass"></div>' +
      '   <!-- /ko -->' +
      '  <!-- ko ifnot: $data.hasText -->' +
      '  <div data-bind="cesiumSvgPath: { path: $data.svgIcon, width: $data.svgWidth, height: $data.svgHeight }, css: $data.isActive ?  \'navigation-control-icon-active \' + $data.cssClass : $data.cssClass"></div>' +
      '  <!-- /ko -->' +
      ' </div>' +
      ' <!-- /ko -->' +
      '</div>';
    }
    loadView(testing, container, this);
    // loadView(navigatorTemplate, container, this);
    //  loadView(require('fs')
    // .readFileSync(baseURLEmpCesium +
    // 'js-lib/terrajs/lib/Views/Navigation.html', 'utf8'), container, this);
  };

  /**
      * Adds a control to this toolbar.
      * @param {NavControl} control The control to add.
      */
  NavigationViewModel.prototype.add = function (control) {
    this.controls.push(control);
  };

  /**
      * Removes a control from this toolbar.
      * @param {NavControl} control The control to remove.
      */
  NavigationViewModel.prototype.remove = function (control) {
    this.controls.remove(control);
  };

  /**
      * Checks if the control given is the last control in the control array.
      * @param {NavControl} control The control to remove.
      */
  NavigationViewModel.prototype.isLastControl = function (control) {
    return control === this.controls[this.controls.length - 1];
  };

  var vectorScratch = new cesium.Cartesian2();

  NavigationViewModel.prototype.handleMouseDown = function (viewModel, e) {var
    scene = this.terria.scene;
    if (scene.mode === cesium.SceneMode.MORPHING) {
      return true;
    }
    if (viewModel.navigationLocked) {
      return true;
    }

    var compassElement = e.currentTarget;
    var compassRectangle = e.currentTarget.getBoundingClientRect();
    var maxDistance = compassRectangle.width / 2.0;
    var center = new cesium.Cartesian2(
    (compassRectangle.right - compassRectangle.left) / 2.0,
    (compassRectangle.bottom - compassRectangle.top) / 2.0);

    var clickLocation = new cesium.Cartesian2(
    e.clientX - compassRectangle.left,
    e.clientY - compassRectangle.top);

    var vector = cesium.Cartesian2.subtract(clickLocation, center, vectorScratch);
    var distanceFromCenter = cesium.Cartesian2.magnitude(vector);

    var distanceFraction = distanceFromCenter / maxDistance;

    var nominalTotalRadius = 145;
    var norminalGyroRadius = 50;

    if (distanceFraction < norminalGyroRadius / nominalTotalRadius) {
      orbit(this, compassElement, vector);
      //            return false;
    } else if (distanceFraction < 1.0) {
      rotate(this, compassElement, vector);
      //            return false;
    } else {
      return true;
    }
  };

  var oldTransformScratch = new cesium.Matrix4();
  var newTransformScratch = new cesium.Matrix4();
  var centerScratch = new cesium.Cartesian3();

  NavigationViewModel.prototype.handleDoubleClick = function (viewModel) {var
    scene = viewModel.terria.scene;var
    camera = scene.camera;

    var sscc = scene.screenSpaceCameraController;

    if (scene.mode === cesium.SceneMode.MORPHING || !sscc.enableInputs) {
      return true;
    }
    if (viewModel.navigationLocked) {
      return true;
    }
    if (scene.mode === cesium.SceneMode.COLUMBUS_VIEW && !sscc.enableTranslate) {
      return;
    }
    if (
    scene.mode === cesium.SceneMode.SCENE3D ||
    scene.mode === cesium.SceneMode.COLUMBUS_VIEW)
    {
      if (!sscc.enableLook) {
        return;
      }

      if (scene.mode === cesium.SceneMode.SCENE3D) {
        if (!sscc.enableRotate) {
          return;
        }
      }
    }

    var center = getCameraFocus(viewModel.terria, true, centerScratch);

    if (!cesium.defined(center)) {
      // Globe is barely visible, so reset to home view.

      this.controls[1].resetView();
      return;
    }

    var cameraPosition = scene.globe.ellipsoid.cartographicToCartesian(
    camera.positionCartographic,
    new cesium.Cartesian3());


    var surfaceNormal = scene.globe.ellipsoid.geodeticSurfaceNormal(center);

    var focusBoundingSphere = new cesium.BoundingSphere(center, 0);

    camera.flyToBoundingSphere(focusBoundingSphere, {
      offset: new cesium.HeadingPitchRange(
      0,
      // do not use camera.pitch since the pitch at the center/target is required
      cesium.Math.PI_OVER_TWO -
      cesium.Cartesian3.angleBetween(surfaceNormal, camera.directionWC),
      // distanceToBoundingSphere returns wrong values when in 2D or Columbus view so do not use
      // camera.distanceToBoundingSphere(focusBoundingSphere)
      // instead calculate distance manually
      cesium.Cartesian3.distance(cameraPosition, center)),

      duration: 1.5 });

  };

  NavigationViewModel.create = function (options) {
    // options.enableZoomControls = this.enableZoomControls;
    // options.enableCompass = this.enableCompass;
    var result = new NavigationViewModel(options);
    result.show(options.container);
    return result;
  };

  function orbit(_viewModel, compassElement, cursorVector) {
    var viewModel = _viewModel;var
    scene = viewModel.terria.scene;

    var sscc = scene.screenSpaceCameraController;

    // do not orbit if it is disabled
    if (scene.mode === cesium.SceneMode.MORPHING || !sscc.enableInputs) {
      return;
    }
    if (viewModel.navigationLocked) {
      return true;
    }

    switch (scene.mode) {
      case cesium.SceneMode.COLUMBUS_VIEW:
        if (sscc.enableLook) {
          break;
        }

        if (!sscc.enableTranslate || !sscc.enableTilt) {
          return;
        }
        break;
      case cesium.SceneMode.SCENE3D:
        if (sscc.enableLook) {
          break;
        }

        if (!sscc.enableTilt || !sscc.enableRotate) {
          return;
        }
        break;
      case cesium.SceneMode.SCENE2D:
        if (!sscc.enableTranslate) {
          return;
        }
        break;
      default:
        console.warn('scene.mode:' + scene.mode + ' bad case');}


    // Remove existing event handlers, if any.
    document.removeEventListener(
    'mousemove',
    viewModel.orbitMouseMoveFunction,
    false);

    document.removeEventListener(
    'mouseup',
    viewModel.orbitMouseUpFunction,
    false);


    if (cesium.defined(viewModel.orbitTickFunction)) {
      viewModel.terria.clock.onTick.removeEventListener(
      viewModel.orbitTickFunction);

    }

    viewModel.orbitMouseMoveFunction = undefined;
    viewModel.orbitMouseUpFunction = undefined;
    viewModel.orbitTickFunction = undefined;

    viewModel.isOrbiting = true;
    viewModel.orbitLastTimestamp = cesium.getTimestamp();var

    camera = scene.camera;

    if (cesium.defined(viewModel.terria.trackedEntity)) {
      // when tracking an entity simply use that reference frame
      viewModel.orbitFrame = undefined;
      viewModel.orbitIsLook = false;
    } else {
      var center = getCameraFocus(viewModel.terria, true, centerScratch);

      if (!cesium.defined(center)) {
        viewModel.orbitFrame = cesium.Transforms.eastNorthUpToFixedFrame(
        camera.positionWC,
        scene.globe.ellipsoid,
        newTransformScratch);

        viewModel.orbitIsLook = true;
      } else {
        viewModel.orbitFrame = cesium.Transforms.eastNorthUpToFixedFrame(
        center,
        scene.globe.ellipsoid,
        newTransformScratch);

        viewModel.orbitIsLook = false;
      }
    }

    // eslint-disable-next-line no-unused-vars
    viewModel.orbitTickFunction = function (e) {
      var timestamp = cesium.getTimestamp();
      var deltaT = timestamp - viewModel.orbitLastTimestamp;
      var rate = (viewModel.orbitCursorOpacity - 0.5) * 2.5 / 1000;
      var distance = deltaT * rate;

      var angle = viewModel.orbitCursorAngle + cesium.Math.PI_OVER_TWO;
      var x = Math.cos(angle) * distance;
      var y = Math.sin(angle) * distance;

      var oldTransform = void 0;

      if (viewModel.navigationLocked) {
        return true;
      }

      if (cesium.defined(viewModel.orbitFrame)) {
        oldTransform = cesium.Matrix4.clone(camera.transform, oldTransformScratch);

        camera.lookAtTransform(viewModel.orbitFrame);
      }

      // do not look up/down or rotate in 2D mode
      if (scene.mode === cesium.SceneMode.SCENE2D) {
        camera.move(
        new cesium.Cartesian3(x, y, 0),
        Math.max(scene.canvas.clientWidth, scene.canvas.clientHeight) / 100 *
        camera.positionCartographic.height *
        distance);

      } else {
        if (viewModel.orbitIsLook) {
          camera.look(cesium.Cartesian3.UNIT_Z, -x);
          camera.look(camera.right, -y);
        } else {
          camera.rotateLeft(x);
          camera.rotateUp(y);
        }
      }

      if (cesium.defined(viewModel.orbitFrame)) {
        camera.lookAtTransform(oldTransform);
      }

      // viewModel.terria.cesium.notifyRepaintRequired();

      viewModel.orbitLastTimestamp = timestamp;
    };

    function updateAngleAndOpacity(vector, compassWidth) {
      var angle = Math.atan2(-vector.y, vector.x);
      viewModel.orbitCursorAngle = cesium.Math.zeroToTwoPi(
      angle - cesium.Math.PI_OVER_TWO);


      var distance = cesium.Cartesian2.magnitude(vector);
      var maxDistance = compassWidth / 2.0;
      var distanceFraction = Math.min(distance / maxDistance, 1.0);
      var easedOpacity = 0.5 * distanceFraction * distanceFraction + 0.5;
      viewModel.orbitCursorOpacity = easedOpacity;

      // viewModel.terria.cesium.notifyRepaintRequired();
    }

    viewModel.orbitMouseMoveFunction = function (e) {
      var compassRectangle = compassElement.getBoundingClientRect();
      var center = new cesium.Cartesian2(
      (compassRectangle.right - compassRectangle.left) / 2.0,
      (compassRectangle.bottom - compassRectangle.top) / 2.0);

      var clickLocation = new cesium.Cartesian2(
      e.clientX - compassRectangle.left,
      e.clientY - compassRectangle.top);

      var vector = cesium.Cartesian2.subtract(clickLocation, center, vectorScratch);
      updateAngleAndOpacity(vector, compassRectangle.width);
    };

    // eslint-disable-next-line no-unused-vars
    viewModel.orbitMouseUpFunction = function (e) {
      // TODO: if mouse didn't move, reset view to looking down, north is up?

      viewModel.isOrbiting = false;
      document.removeEventListener(
      'mousemove',
      viewModel.orbitMouseMoveFunction,
      false);

      document.removeEventListener(
      'mouseup',
      viewModel.orbitMouseUpFunction,
      false);


      if (cesium.defined(viewModel.orbitTickFunction)) {
        viewModel.terria.clock.onTick.removeEventListener(
        viewModel.orbitTickFunction);

      }

      viewModel.orbitMouseMoveFunction = undefined;
      viewModel.orbitMouseUpFunction = undefined;
      viewModel.orbitTickFunction = undefined;
    };

    document.addEventListener(
    'mousemove',
    viewModel.orbitMouseMoveFunction,
    false);

    document.addEventListener('mouseup', viewModel.orbitMouseUpFunction, false);
    viewModel.terria.clock.onTick.addEventListener(viewModel.orbitTickFunction);

    updateAngleAndOpacity(
    cursorVector,
    compassElement.getBoundingClientRect().width);

  }

  function rotate(_viewModel, compassElement, cursorVector) {
    var viewModel = _viewModel;var
    scene = viewModel.terria.scene;var
    camera = scene.camera;

    var sscc = scene.screenSpaceCameraController;
    // do not rotate in 2D mode or if rotating is disabled
    if (
    scene.mode === cesium.SceneMode.MORPHING ||
    scene.mode === cesium.SceneMode.SCENE2D ||
    !sscc.enableInputs)
    {
      return;
    }
    if (viewModel.navigationLocked) {
      return true;
    }

    if (
    !sscc.enableLook && (
    scene.mode === cesium.SceneMode.COLUMBUS_VIEW ||
    scene.mode === cesium.SceneMode.SCENE3D && !sscc.enableRotate))
    {
      return;
    }

    // Remove existing event handlers, if any.
    document.removeEventListener(
    'mousemove',
    viewModel.rotateMouseMoveFunction,
    false);

    document.removeEventListener(
    'mouseup',
    viewModel.rotateMouseUpFunction,
    false);


    viewModel.rotateMouseMoveFunction = undefined;
    viewModel.rotateMouseUpFunction = undefined;

    viewModel.isRotating = true;
    viewModel.rotateInitialCursorAngle = Math.atan2(
    -cursorVector.y,
    cursorVector.x);


    if (cesium.defined(viewModel.terria.trackedEntity)) {
      // when tracking an entity simply use that reference frame
      viewModel.rotateFrame = undefined;
      viewModel.rotateIsLook = false;
    } else {
      var viewCenter = getCameraFocus(
      viewModel.terria,
      true,
      centerScratch);


      if (
      !cesium.defined(viewCenter) ||
      scene.mode === cesium.SceneMode.COLUMBUS_VIEW &&
      !sscc.enableLook &&
      !sscc.enableTranslate)
      {
        viewModel.rotateFrame = cesium.Transforms.eastNorthUpToFixedFrame(
        camera.positionWC,
        scene.globe.ellipsoid,
        newTransformScratch);

        viewModel.rotateIsLook = true;
      } else {
        viewModel.rotateFrame = cesium.Transforms.eastNorthUpToFixedFrame(
        viewCenter,
        scene.globe.ellipsoid,
        newTransformScratch);

        viewModel.rotateIsLook = false;
      }
    }

    var oldTransform = void 0;
    if (cesium.defined(viewModel.rotateFrame)) {
      oldTransform = cesium.Matrix4.clone(camera.transform, oldTransformScratch);
      camera.lookAtTransform(viewModel.rotateFrame);
    }

    viewModel.rotateInitialCameraAngle = -camera.heading;

    if (cesium.defined(viewModel.rotateFrame)) {
      camera.lookAtTransform(oldTransform);
    }

    viewModel.rotateMouseMoveFunction = function (e) {
      var compassRectangle = compassElement.getBoundingClientRect();
      var center = new cesium.Cartesian2(
      (compassRectangle.right - compassRectangle.left) / 2.0,
      (compassRectangle.bottom - compassRectangle.top) / 2.0);

      var clickLocation = new cesium.Cartesian2(
      e.clientX - compassRectangle.left,
      e.clientY - compassRectangle.top);

      var vector = cesium.Cartesian2.subtract(clickLocation, center, vectorScratch);
      var angle = Math.atan2(-vector.y, vector.x);

      var angleDifference = angle - viewModel.rotateInitialCursorAngle;
      var newCameraAngle = cesium.Math.zeroToTwoPi(
      viewModel.rotateInitialCameraAngle - angleDifference);


      // eslint-disable-next-line
      camera = viewModel.terria.scene.camera;

      if (cesium.defined(viewModel.rotateFrame)) {
        oldTransform = cesium.Matrix4.clone(camera.transform, oldTransformScratch);
        camera.lookAtTransform(viewModel.rotateFrame);
      }

      var currentCameraAngle = -camera.heading;
      camera.rotateRight(newCameraAngle - currentCameraAngle);

      if (cesium.defined(viewModel.rotateFrame)) {
        camera.lookAtTransform(oldTransform);
      }

      // viewModel.terria.cesium.notifyRepaintRequired();
    };

    // eslint-disable-next-line no-unused-vars
    viewModel.rotateMouseUpFunction = function (e) {
      viewModel.isRotating = false;
      document.removeEventListener(
      'mousemove',
      viewModel.rotateMouseMoveFunction,
      false);

      document.removeEventListener(
      'mouseup',
      viewModel.rotateMouseUpFunction,
      false);


      viewModel.rotateMouseMoveFunction = undefined;
      viewModel.rotateMouseUpFunction = undefined;
    };

    document.addEventListener(
    'mousemove',
    viewModel.rotateMouseMoveFunction,
    false);

    document.addEventListener('mouseup', viewModel.rotateMouseUpFunction, false);
  }

  var _extends = Object.assign || function (target) {for (var i = 1; i < arguments.length; i++) {var source = arguments[i];for (var key in source) {if (Object.prototype.hasOwnProperty.call(source, key)) {target[key] = source[key];}}}return target;};
  /**
                                             * @alias CesiumNavigation
                                             * @constructor
                                             *
                                             * @param {Viewer|CesiumWidget} viewerCesiumWidget The Viewer or CesiumWidget instance
                                             */
  function CesiumNavigation() {for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {args[_key] = arguments[_key];}
    initialize.apply(this, args);

    this._onDestroyListeners = [];
  }

  CesiumNavigation.prototype.distanceLegendViewModel = undefined;
  CesiumNavigation.prototype.navigationViewModel = undefined;
  CesiumNavigation.prototype.navigationDiv = undefined;
  CesiumNavigation.prototype.distanceLegendDiv = undefined;
  CesiumNavigation.prototype.terria = undefined;
  CesiumNavigation.prototype.container = undefined;
  CesiumNavigation.prototype._onDestroyListeners = undefined;
  CesiumNavigation.prototype._navigationLocked = false;

  CesiumNavigation.prototype.setNavigationLocked = function (locked) {
    this._navigationLocked = locked;
    this.navigationViewModel.setNavigationLocked(this._navigationLocked);
  };

  CesiumNavigation.prototype.getNavigationLocked = function () {
    return this._navigationLocked;
  };

  CesiumNavigation.prototype.destroy = function () {
    if (cesium.defined(this.navigationViewModel)) {
      this.navigationViewModel.destroy();
    }
    if (cesium.defined(this.distanceLegendViewModel)) {
      this.distanceLegendViewModel.destroy();
    }

    if (cesium.defined(this.navigationDiv)) {
      this.navigationDiv.parentNode.removeChild(this.navigationDiv);
    }
    delete this.navigationDiv;

    if (cesium.defined(this.distanceLegendDiv)) {
      this.distanceLegendDiv.parentNode.removeChild(this.distanceLegendDiv);
    }
    delete this.distanceLegendDiv;

    if (cesium.defined(this.container)) {
      this.container.parentNode.removeChild(this.container);
    }
    delete this.container;

    for (var i = 0; i < this._onDestroyListeners.length; i++) {
      this._onDestroyListeners[i]();
    }
  };

  CesiumNavigation.prototype.addOnDestroyListener = function (callback) {
    if (typeof callback === 'function') {
      this._onDestroyListeners.push(callback);
    }
  };

  /**
      * @param {Viewer|CesiumWidget} viewerCesiumWidget The Viewer or CesiumWidget instance
      * @param options
      */
  function initialize(viewerCesiumWidget) {var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : { units: 'kilometers' };
    if (!cesium.defined(viewerCesiumWidget)) {
      throw new cesium.DeveloperError('CesiumWidget or Viewer is required.');
    }

    //        options = defaultValue(options, defaultValue.EMPTY_OBJECT);

    var cesiumWidget = Cesium.defined(viewerCesiumWidget.cesiumWidget)
    ? viewerCesiumWidget.cesiumWidget
    : viewerCesiumWidget;

  // Ensure cesiumWidget.container exists
    if (!cesiumWidget.container) {
        console.error("CesiumNavigation: cesiumWidget.container is undefined.");
        console.log("viewerCesiumWidget was:", viewerCesiumWidget);
        return;
    }
    var container = document.createElement('div');
    container.className = 'cesium-widget-cesiumNavigationContainer';
    cesiumWidget.container.appendChild(container);

    this.terria = viewerCesiumWidget;
    this.terria.options = cesium.defined(options) ? options : {};
    this.terria.afterWidgetChanged = new cesium.Event();
    this.terria.beforeWidgetChanged = new cesium.Event();
    this.container = container;

    //  this.navigationDiv.setAttribute("id", "navigationDiv");

    // Register custom Knockout.js bindings.
    // If you're not using the TerriaJS user interface, you can remove this.
    registerKnockoutBindings();

    if (
    !cesium.defined(this.terria.options.enableDistanceLegend) ||
    this.terria.options.enableDistanceLegend)
    {
      this.distanceLegendDiv = document.createElement('div');
      container.appendChild(this.distanceLegendDiv);
      this.distanceLegendDiv.setAttribute('id', 'distanceLegendDiv');
      this.distanceLegendViewModel = DistanceLegendViewModel.create(_extends({},
      options, {
        container: this.distanceLegendDiv,
        terria: this.terria,
        mapElement: container,
        enableDistanceLegend: true,
        containerWidth: this.terria.options.containerWidth }));

    }

    if (
    (!cesium.defined(this.terria.options.enableZoomControls) ||
    this.terria.options.enableZoomControls) && (
    !cesium.defined(this.terria.options.enableCompass) ||
    this.terria.options.enableCompass))
    {
      this.navigationDiv = document.createElement('div');
      this.navigationDiv.setAttribute('id', 'navigationDiv');
      container.appendChild(this.navigationDiv);
      // Create the navigation controls.
      this.navigationViewModel = NavigationViewModel.create({
        container: this.navigationDiv,
        terria: this.terria,
        enableZoomControls: true,
        enableCompass: true });

    } else if (
    cesium.defined(this.terria.options.enableZoomControls) &&
    !this.terria.options.enableZoomControls && (
    !cesium.defined(this.terria.options.enableCompass) ||
    this.terria.options.enableCompass))
    {
      this.navigationDiv = document.createElement('div');
      this.navigationDiv.setAttribute('id', 'navigationDiv');
      container.appendChild(this.navigationDiv);
      // Create the navigation controls.
      this.navigationViewModel = NavigationViewModel.create({
        container: this.navigationDiv,
        terria: this.terria,
        enableZoomControls: false,
        enableCompass: true });

    } else if (
    (!cesium.defined(this.terria.options.enableZoomControls) ||
    this.terria.options.enableZoomControls) &&
    cesium.defined(this.terria.options.enableCompass) &&
    !this.terria.options.enableCompass)
    {
      this.navigationDiv = document.createElement('div');
      this.navigationDiv.setAttribute('id', 'navigationDiv');
      container.appendChild(this.navigationDiv);
      // Create the navigation controls.
      this.navigationViewModel = NavigationViewModel.create({
        container: this.navigationDiv,
        terria: this.terria,
        enableZoomControls: true,
        enableCompass: false });

    } else if (
    cesium.defined(this.terria.options.enableZoomControls) &&
    !this.terria.options.enableZoomControls &&
    cesium.defined(this.terria.options.enableCompass) &&
    !this.terria.options.enableCompass)
    ;
  }

  /**
                                             * Created by Larcius on 18.02.16.
                                             */

  /**
                                                 * A mixin which adds the Compass/Navigation widget to the Viewer widget.
                                                 * Rather than being called directly, this function is normally passed as
                                                 * a parameter to {@link Viewer#extend}, as shown in the example below.
                                                 * @exports viewerCesiumNavigationMixin
                                                 *
                                                 * @param {Viewer} viewer The viewer instance.
                                                 * @param {{}} options The options.
                                                 *
                                                 * @exception {DeveloperError} viewer is required.
                                                 *
                                                 * @demo {@link http://localhost:8080/index.html|run local server with examples}
                                                 *
                                                 * @example
                                                 * const viewer = new Cesium.Viewer('cesiumContainer');
                                                 * viewer.extend(viewerCesiumNavigationMixin);
                                                 */
  function viewerCesiumNavigationMixin(viewer, options) {
    if (!cesium.defined(viewer)) {
      throw new cesium.DeveloperError('viewer is required.');
    }

    var cesiumNavigation = init(viewer, options);

    cesiumNavigation.addOnDestroyListener(
    function (_viewer) {return function () {
        var v = _viewer;
        delete v.cesiumNavigation;
      };}(viewer));


    Object.defineProperties(viewer, {
      cesiumNavigation: {
        configurable: true,
        get: function get() {return viewer.cesiumWidget.cesiumNavigation;} } });


  }

  /**
     *
     * @param {CesiumWidget} cesiumWidget The cesium widget instance.
     * @param {{}} options The options.
     */
  viewerCesiumNavigationMixin.mixinWidget = function () {return init.apply(undefined, arguments);};

  /**
                                                                                                     * @param {Viewer|CesiumWidget} viewerCesiumWidget The Viewer or CesiumWidget instance
                                                                                                     * @param {{}} options the options
                                                                                                     */
  var init = function init(viewerCesiumWidget, options) {
    var cesiumNavigation = new CesiumNavigation(viewerCesiumWidget, options);

    var cesiumWidget = cesium.defined(viewerCesiumWidget.cesiumWidget) ?
    viewerCesiumWidget.cesiumWidget :
    viewerCesiumWidget;

    Object.defineProperties(cesiumWidget, {
      cesiumNavigation: {
        configurable: true,
        get: function get() {return cesiumNavigation;} } });



    cesiumNavigation.addOnDestroyListener(
    function (_cW) {
      var _cesiumWidget = _cW;
      return function () {
        delete _cesiumWidget.cesiumNavigation;
      };
    }(cesiumWidget));


    return cesiumNavigation;
  };

  return viewerCesiumNavigationMixin;

}(markdownit,markdownitSanitizer,Hammer,ko,Cesium));