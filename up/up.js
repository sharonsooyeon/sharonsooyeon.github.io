/*
THREE.js model of the house from Pixar's Up.
Copyright (C) 2017 Sharon Kim sharon.s.kim@wellesley.edu
                   Stacey Kim stacey.kim@wellesley.edu
                   Sarah Walters (swalters4925@gmail.com)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/


var UP = (function() {

  var PARAMS = (function() {
    var meshRadius = 5;
    var ribbon = {
      height: 75, // vertical distance from where ribbons gather to center of balloon cloud
      color: 0xcccccc
    };
    var balloon = {
      height: 10,
      shininess: 50,
      opacity: 0.7
    };
    var house = {
      width: 50
    };

    function getBoundingBox() {
      var balloonCloudRadius = balloon.height * meshRadius;
      return {
        minx: -300, maxx: -100,
        miny: 0, maxy: 300,
        minz: 0, maxz: 300,
      };
    }

    return {
      meshRadius: meshRadius,
      ribbon: ribbon,
      balloon: balloon,
      house: house,
      getBoundingBox: getBoundingBox
    };
  })();

  // UTILS allows for rotation and position adjustments.
  var UTILS = {
    setPosition: function(obj, position) {
      obj.position.set(position.x, position.y, position.z);
    },

    setRotation: function(obj, rotation) {
      obj.rotation.set(rotation.a, rotation.b, rotation.c);
    },

    callTwice: function(fn) {
      fn();
      fn();
    },

    // Returns a random hex color
    // http://stackoverflow.com/questions/1484506/random-color-generator-in-javascript
    getRandomColor: function() {
      var colors = [
        0xf442b9, // pink_c
        0xf44242, // red
        0xf47a42, // orange
        0xf4d142, // yellow
        0x8cf442, // lime green
        0x42e2f4, // light blue
        0x4274f4, // dark blue
        0x7d42f4  // purple
      ]
      return colors[Math.floor(Math.random() * colors.length)];
    }
  };

  /* Origin is center of base of cone representing tie-off at bottom of balloon
     Rotationally symmetrical about y axis, which points up through center of balloon
     Colors for the balloons are randomized. */
  function Balloon(position) {
    var _balloonBezier = new THREE.CubicBezierCurve(
      new THREE.Vector2(-0.05, -0.05),
      new THREE.Vector2(0.35, 0.1),
      new THREE.Vector2(0.8, 0.95),
      new THREE.Vector2(0, 1)
    );
    var _balloonPoints = _balloonBezier.getPoints(20);

    var _makeBalloon = function(height) {
      var controlPoints = _balloonPoints.map(function(cp) {
        return cp.multiplyScalar(height);
      });
      var balloonGeometry = new THREE.LatheGeometry(controlPoints, 20);
      var balloonMaterial = new THREE.MeshPhongMaterial({
        color: UTILS.getRandomColor(),
        shininess: PARAMS.balloon.shininess,
        transparent: true,
        opacity: PARAMS.balloon.opacity
      });
      return new THREE.Mesh(balloonGeometry, balloonMaterial);
    };

    var result = _makeBalloon(PARAMS.balloon.height);

    // balloon is at position
    // ribbons join at (0, -PARAMS.ribbonHeight, 0)
    // Rotates the balloon vertically so it lines up with its ribbon
    result.calculateRotation = function() {
      var deltaY = position.y + PARAMS.ribbon.height;
      var aRotation = Math.tan(position.z / deltaY);
      var cRotation = -Math.tan(position.x / deltaY);

      return { a: aRotation, b: 0, c: cRotation };
    };

    return result;
  }

  function Ribbon(balloonPosition) {
    var ribbonGeometry = new THREE.Geometry();
    ribbonGeometry.vertices.push(
      new THREE.Vector3(balloonPosition.x, balloonPosition.y, balloonPosition.z),
      new THREE.Vector3(0, -PARAMS.ribbon.height, 0));
    var ribbonMaterial = new THREE.LineBasicMaterial({
      color: PARAMS.ribbon.color
    });
    return new THREE.Line(ribbonGeometry, ribbonMaterial);
  }

  // origin is where the balloons' ribbons gather
  // y axis points up towards the top of the cloud
  function BalloonCloud() {
    var _jitterMeshPosition = function(n) {
      var center = n * PARAMS.balloon.height;
      var rand = Math.random() - 0.5; // random number between -0.5 and 0.5
      return (1 + rand) * center;
    };

    var _generateBalloonPositions = function() {
      var positions = [];
      for (var i = -PARAMS.meshRadius; i < PARAMS.meshRadius; i++) {
        for (var j = -PARAMS.meshRadius; j < PARAMS.meshRadius; j++) {
          for (var k = -PARAMS.meshRadius; k < PARAMS.meshRadius; k++) {
            var distanceFromOrigin = 
              Math.sqrt(Math.pow(i, 2) + (Math.pow(j, 2) / 20) + Math.pow(k, 2));
            if (distanceFromOrigin <= PARAMS.meshRadius) {
              UTILS.callTwice(function() {
                positions.push({
                  x: _jitterMeshPosition(i),
                  y: _jitterMeshPosition(j),
                  z: _jitterMeshPosition(k)
                });
              });
            }
          }
        }
      }
      return positions;
    };

    var _makeBalloonCloud = function() {
      var cloud = new THREE.Object3D();

      var positions = _generateBalloonPositions();
      positions.map(function(position) {
        var balloon = new Balloon(position);
        UTILS.setPosition(balloon, position);
        var rotation = balloon.calculateRotation();
        UTILS.setRotation(balloon, rotation);
        var ribbon = new Ribbon(position);
        cloud.add(balloon);
        cloud.add(ribbon);
      });

      return cloud;
    };

    var result = new THREE.Object3D();
    var cloud = _makeBalloonCloud();
    UTILS.setPosition(cloud, {x: 0, y: PARAMS.ribbon.height, z: 0});
    result.add(cloud);
    return result;
  }

  // For assigning texture coordinates. Pushes face coordinates into 
  // a UVs array to be attached to the textured geometry.
  function fc(UVs, as,at, bs,bt, cs,ct) {
    UVs.push(
      [ new THREE.Vector2(as,at),
        new THREE.Vector2(bs,bt),
        new THREE.Vector2(cs,ct), ]);
  }

  function Barn(type, width, length, height, roofProportion, materials) {

    function _base(geometry) {
      var UVs = [];

      // Pink pentagonal face
      fc(UVs, 3,0, 0,3, 3,3); fc(UVs, 0,0, 0.5,2, 1,0); fc(UVs, 0,0, 3,3, 3,0);

      // Yellow pentagonal face
      fc(UVs, 0,0, 4,0, 4,2.5); fc(UVs, 0,0, 1,2, 2,0); fc(UVs, 4,1.5, 4,4, 4,1.5);

      // Side
      fc(UVs, 3,0, 3,3, 0,0); fc(UVs, 3,3, 0,3, 0,0);

      // Side roof
      fc(UVs, 0,0, 1,0, 1,1); fc(UVs, 0,1, 0,0, 1,1); fc(UVs, 1,0, 0,1, 0,0);
      fc(UVs, 1,3, 0,1, 1,0);

      // Back blue rectangle
      fc(UVs, 3,0, 3,3, 0,0); fc(UVs, 3,3, 0,3, 0,0);

      // Bottom
      fc(UVs, 0,0, 1,0, 0,1); fc(UVs, 1,0, 1,1, 0,1);

      geometry.faceVertexUvs = [ UVs ];
    }

    function _cross(geometry) {
      var UVs = [];

      // Pink front
      fc(UVs, 0,1, 0,0, 1,0); fc(UVs, 0,0, 0.5,2, 1,0); fc(UVs, 0,0, 1,1, 1,0);

      // Yellow back
      fc(UVs, 0,0, 3,0, 3,1.5); fc(UVs, 0,0, 0.9,3, 3,0); fc(UVs, 0,1.5, 0,0, 3,1.5);

      // Blue side
      fc(UVs, 1,0, 1,1, 0,0); fc(UVs, 1,1, 0,1, 0,0);

      // Roof above blue
      fc(UVs, 0,0, 1,0, 1,1); fc(UVs, 0,1, 0,0, 1,1);

      // Roof above pink
      fc(UVs, 1,0, 0,1, 0,0); fc(UVs, 1,1, 0,1, 1,0);

      // Pink side
      fc(UVs, 1,0, 1,1, 0,0); fc(UVs, 1,1, 0,1, 0,0);

      // Bottom
      fc(UVs, 0,0, 1,0, 0,1); fc(UVs, 1,0, 1,1, 0,1);

      geometry.faceVertexUvs = [ UVs ];
    }

    //Assigns texture coordinates to the gable.
    function _gable(geometry) {
      var UVs = [];

      // Bogus texture coordinates
      fc(UVs, 0,1, 0,0, 1,0); fc(UVs, 0,0, 0.5,2, 1,0); fc(UVs, 0,0, 1,1, 1,0);

      // Front yellow panels. The only side visible, so the only side that matters.
      fc(UVs, 0,0, 2,0, 2,1.2); fc(UVs, 1,0, 1,1, 1,0); fc(UVs, 0,1.5, 2,0, 2,1.5);

      // Bogus texture coordinates
      fc(UVs, 1,0, 1,1, 0,0); fc(UVs, 1,1, 0,1, 0,0); fc(UVs, 0,0, 1,0, 1,1); 
      fc(UVs, 0,1, 0,0, 1,1); fc(UVs, 1,0, 0,1, 0,0); fc(UVs, 1,1, 0,1, 1,0); 
      fc(UVs, 1,0, 1,1, 0,0); fc(UVs, 1,1, 0,1, 0,0); fc(UVs, 0,0, 1,0, 0,1); 
      fc(UVs, 1,0, 1,1, 0,1);

      geometry.faceVertexUvs = [ UVs ];
    }

    var extrudeSettings = {
      amount: length,
      bevelEnabled: false
    };

    var roofStartY = 1 - roofProportion;
    var pts = [[0,0], [1,0], [1,roofStartY], [0.5,1], [0,roofStartY], [0,0]].map(function(pt) {
      return new THREE.Vector2(pt[0] * width, pt[1] * height);
    });

    var shape = new THREE.Shape(pts);
    var barnGeometry = new THREE.ExtrudeGeometry( shape, extrudeSettings );

    barnGeometry.faces.map(function(face, i) {
      face.materialIndex = i;
    });

    // Call the appropriate texture mapping function for the correct structure
    if (type == "cross") _cross(barnGeometry);
    else if (type == "gable") _gable(barnGeometry);
    else if (type == "base") _base(barnGeometry);

    var barnMaterial = new THREE.MeshFaceMaterial(materials);
    var mesh = new THREE.Mesh(barnGeometry, barnMaterial);
    return mesh;
  }


  // Similar to fc, fcs is a helper function for assigning texture coordinates.
  // However, fcs accepts a scale factor. The two roofs to be created are 
  // identically texture mapped but with differently scaled coordinates.
  function fcs(UVs, scale, as,at, bs,bt, cs,ct) {
    var s = scale;
    UVs.push(
      [ new THREE.Vector2(as,at)*s,
        new THREE.Vector2(bs,bt)*s,
        new THREE.Vector2(cs,ct)*s, ]);
  }

  function Roof(type, width, height, length, roofProportion, materials) {

    function _tc(geometry, scale) {
      var s = scale;
      var UVs = [];
      
      // Upside down Vs
      fcs(UVs,s, 0,0, 0,0, 0,0); fcs(UVs,s, 1,0, 1,0, 0,1); fcs(UVs,s, 1,0, 0,0, 0,1);
      fcs(UVs,s, 1,0, 0,0, 1,1);

      // Undersides of length
      fcs(UVs,s, 1,0, 0,0, 0,1); fcs(UVs,s, 1,0, 0,0, 0,1);

      // Top of length
      fcs(UVs,s, 1,0, 0,0, 0,1); fcs(UVs,s, 1,0, 0,0, 0,1);

      // Right sides
      fcs(UVs,s, 1,0, 1,1, 0,0); fcs(UVs,s, 0,1, 1,1, 1,0);

      // Left sides
      fcs(UVs,s, 1,0, 1,1, 0,0); fcs(UVs,s, 0,1, 1,1, 1,0);

      geometry.faceVertexUvs = [ UVs ];
    }

    var roof = new THREE.Object3D();

    var roofGeometry = new THREE.BoxGeometry(width, height, length);

    roofGeometry.faces.map(function (face, i) {
      face.materialIndex = i;
    });

    if (type == "small") _tc(roofGeometry, 1);
    else if (type == "cross") _tc(roofGeometry, 2.5);

    var left = new THREE.Mesh(roofGeometry, new THREE.MeshFaceMaterial(materials));
    var right = left.clone();

    var angle = Math.tan(roofProportion/0.5);
    var shift = height*Math.sin(angle);

    left.rotation.x = -angle;
    left.position.set(0, 0, -shift);
    right.rotation.x = angle;

    roof.add(left);
    roof.add(right);
    return roof;
  }

  // The CrossGableCurve is the curve that protudes out of the CrossBarn.
  function CrossGableCurve(width, height, length, material) {
    var extrudeSettings = {
      amount: length,
      bevelEnabled: false,
    }

    var pts = [[0,1,0], [0.1,0.4,0], [0.4,-0.01,0], [1,0,0]].map(function(pt) {
      return new THREE.Vector3(pt[0]*width, pt[1]*height, 0);
    });

    var curve = new THREE.CubicBezierCurve3(pts[0], pts[1], pts[2], pts[3]);
    var points = Array.prototype.concat(curve.getPoints(10), 
      [ new THREE.Vector3(-10,0,0), new THREE.Vector3(-10,height,0) ]);
    var shape = new THREE.Shape(points);
    var geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    geometry.faces.map(function(face, i) {
      face.materialIndex = i;
    });

    var mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = -0.1;

    // Texture mapping to a Bezier structure is difficult, so drape a textured 
    // Bezier cloth over this structure instead.
    var object = new THREE.Object3D();
    object.add(mesh);

    var clothPts = [
      [ [0,10,0    ], [0.5,4,0    ], [2,-0.1,0    ], [5,0,0    ] ],
      [ [0,10,6.67 ], [0.5,4,6.67 ], [2,-0.1,6.67 ], [5,0,6.67 ] ],
      [ [0,10,13.33], [0.5,4,13.33], [2,-0.1,13.33], [5,0,13.33] ],
      [ [0,10,20   ], [0.5,4,20   ], [2,-0.1,20   ], [5,0,20   ] ],
    ];
    
    var clothGeometry = new THREE.BezierSurfaceGeometry(clothPts.reverse(), 10, 10);
    var cloth = new THREE.Mesh(clothGeometry, material);
    object.add(cloth);

    return object;
  }

  // The bay structure is the three-windowed structure that protrudes from the front 
  // of the cross barn.
  function BayStructure(width, height, length, materials) {

    function _tc(geometry) {
      var UVs = [];

      // Top
      fc(UVs, 0,1, 1,0, 0,0); fc(UVs, 0,0, 0,0, 0,1);

      // Bottom
      fc(UVs, 1,0, 0,0, 0,1); fc(UVs, 0,1, 1,1, 1,0);

      // Right side
      fc(UVs, 0,0, 2,0, 2,2); fc(UVs, 2,0, 2,2, 0,2);

      // Front
      fc(UVs, 0,0, 2,0, 2,2); fc(UVs, 2,0, 2,2, 0,2);

      // Left side
      fc(UVs, 0,0, 2,0, 2,2); fc(UVs, 2,0, 2,2, 0,2);

      // Back
      fc(UVs, 1,0, 1,1, 0,0); fc(UVs, 0,1, 1,1, 1,0);

      geometry.faceVertexUvs = [ UVs ];
    }

    var extrudeSettings = {
      amount: height,
      bevelEnabled: false,
    };

    var pts = [[0.1,0], [0.3,-0.65], [0.7,-0.65], [0.9,0]].map(function(pt) {
      return new THREE.Vector2(pt[0] * width, pt[1] * length);
    });
    var shape = new THREE.Shape(pts);
    var geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    geometry.faces.map(function (face, i) {
      face.materialIndex = i;
    });

    _tc(geometry);

    var mesh = new THREE.Mesh(geometry, new THREE.MeshFaceMaterial(materials));
    return mesh;
  }

  // A general-purpose structure used for windows, doors, and window panes.
  function Box(width, length, height, color, shininess) {
    shininess = shininess || 0;

    var boxGeometry = new THREE.BoxGeometry(width, length, height);
    boxGeometry.faces.map(function(face,i) {
      face.materialIndex = i;
    });

    var boxMaterial;
    if (color == null) {
      boxMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff, shininess: shininess });
    } else if (typeof(color) == 'number') { // single color
      boxMaterial = new THREE.MeshPhongMaterial({color: color, shininess: shininess});
    } else { // array of colors
      var materials = color.map(function(c) {
      return new THREE.MeshPhongMaterial({color: c, shininess: shininess});
      });
      boxMaterial = new THREE.MeshFaceMaterial(materials);
    }
    return new THREE.Mesh(boxGeometry, boxMaterial);
  }

  // Some box structures need textures, such as the steps and chimney.
  // This changes the code structurally quite a bit, so we've created a 
  // separate function for it.
  function TexturedBox(type, width, length, height,  materials) {

    function _tc(geometry, scale) {
      var s = scale;
      var UVs = [];
      
      // Front
      fcs(UVs,s, 1,1, 1,0, 0,1); fcs(UVs,s, 1,0, 0,0, 0,1);

      // Back
      fcs(UVs,s, 0,1, 1,0, 0,1); fcs(UVs,s, 1,0, 0,0, 0,1);

      // Top
      fcs(UVs,s, 1,1, 0,1, 1,0); fcs(UVs,s, 1,0, 1,1, 0,1);

      // Bottom
      fcs(UVs,s, 1,1, 0,1, 1,0); fcs(UVs,s, 1,0, 1,1, 0,1);

      // Right
      fcs(UVs,s, 0,1, 1,0, 1,1); fcs(UVs,s, 1,0, 0,0, 0,1);

      // Left
      fcs(UVs,s, 0,1, 1,0, 1,1); fcs(UVs,s, 1,0, 0,0, 0,1);

      geometry.faceVertexUvs = [ UVs ];
    }

    var boxGeometry = new THREE.BoxGeometry(width, length, height);
    boxGeometry.faces.map(function(face, i) {
      face.materialIndex = i;
    });

    if (type == "cross") _tc(boxGeometry, 3);
    else _tc(boxGeometry, 1);

    return new THREE.Mesh(boxGeometry, new THREE.MeshFaceMaterial(materials));
  }

  function Chimney(type, width, height, material) {
    var result = new THREE.Object3D();

    var stem = new TexturedBox(type, width, height, width, material);
    UTILS.setPosition(stem, {x: 0, y: height / 2, z: 0});
    result.add(stem);

    var top = new TexturedBox(type, width * 1.2, height * .4, width * 1.2, material);
    UTILS.setPosition(top, {x: 0, y: height - height * 0.2, z: 0});
    result.add(top);

    return result;
  }

  // Origin is at center of base of post
  // y axis runs up through post
  function Post(radius, height, color) {
    var result = new THREE.Object3D();

    var postGeometry = new THREE.CylinderGeometry(radius, radius, height, 20, 20);
    var postMaterial = new THREE.MeshLambertMaterial({color: color});
    var postMesh = new THREE.Mesh(postGeometry, postMaterial);
    UTILS.setPosition(postMesh, {x: 0, y: height / 2, z: 0});
    result.add(postMesh);

    return result;
  }

  // Origin is in center of door box
  // x axis is perpendicular to window; width along z and height along y
  function PaneBase(width, height, thickness, trimColor, paneColor, paneShininess) {
    var result = new THREE.Object3D();

    var trimThickness = thickness * 2;
    var trimWidth = thickness / 3;

    var pane = new Box(thickness, height, width, paneColor, paneShininess);
    result.add(pane);

    var frameTop = new Box(trimThickness, trimWidth, width, trimColor);
    UTILS.setPosition(frameTop, {x: 0, y: height / 2, z: 0});
    result.add(frameTop);

    var frameMiddle = new Box(trimThickness, trimWidth, width, trimColor);
    result.add(frameMiddle);

    var frameBottom = new Box(trimThickness, trimWidth, width, trimColor);
    UTILS.setPosition(frameBottom, {x: 0, y: -height / 2, z: 0});
    result.add(frameBottom);

    var frameLeft = new Box(trimThickness, height + trimWidth, trimWidth, trimColor);
    UTILS.setPosition(frameLeft, {x: 0, y: 0, z: width / 2});
    result.add(frameLeft);

    var frameRight = new Box(trimThickness, height + trimWidth, trimWidth, trimColor);
    UTILS.setPosition(frameRight, {x: 0, y: 0, z: -width / 2});
    result.add(frameRight);

    return result;
  }

  // Origin is in center of window box
  // x axis is perpendicular to window; width along z and height along y
  function Window(width, height, thickness, trimColor, paneColor) {
    return PaneBase(width, height, thickness, trimColor, paneColor, 30);
  }

  function Door(width, height, thickness, color) {
    return PaneBase(width, height, thickness, color, color, 0);
  }

  // Origin is in the center of the bottom of the back face of the stairs
  // x axis runs parallel to step edge; y axis points upwards
  function Steps(type, width, height, material) {
    var result = new THREE.Object3D();
    var stepDepth = height / 3;

    var topStep = new TexturedBox(type, width, stepDepth, stepDepth, material);
    UTILS.setPosition(topStep, {x: 0, y: stepDepth * 5 / 2, z: stepDepth / 2});
    result.add(topStep);

    var middleStep = new TexturedBox(type, width, stepDepth, stepDepth * 2, material);
    UTILS.setPosition(middleStep, {x: 0, y: stepDepth * 3 / 2, z: stepDepth});
    result.add(middleStep);

    var bottomStep = new TexturedBox(type, width, stepDepth, height, material);
    UTILS.setPosition(bottomStep, {x: 0, y: stepDepth / 2, z: stepDepth * 3 / 2});
    result.add(bottomStep);

    return result;
  }

  // Entire house is parameterized by width
  // Origin is in back right bottom corner
  function House(materials) {

    var result = new THREE.Object3D();
    var width = PARAMS.house.width;

    var white    = 0xffffff; var yellow  = 0xfff07f; var pink_c  = 0xf9acb9; 
    var orange_c = 0xffbb7c; var skyBlue = 0x8fb7f7; var taupe   = 0x8e8e84;
    var brick    = 0xb85a51;

    var blue          = materials[0];  var chimney         = materials[1];
    var green         = materials[2];  var orange          = materials[3];
    var patio_floor   = materials[4];  var patio_pillar    = materials[5];
    var pink          = materials[6];  var roof            = materials[7];
    var yellow_panels = materials[8];  var yellow_shingles = materials[9];
    var bottom        = materials[10]; var bezier_texture  = materials[11];
    var clouds        = materials[12];


    // ====================================================================================================
    // BASE BARN
    // ====================================================================================================
    var baseBarnMaterials = [
      pink, pink, pink, pink, pink, pink, pink, pink, pink, pink, pink, // pentagonal face
      yellow_panels, yellow_panels, yellow_panels, yellow_panels, yellow_panels, yellow_panels, 
      yellow_panels, yellow_panels, yellow_panels, // pentagonal face with cutout
      blue, blue, blue, green, green, green,  green, // front rectangle, with cutout
      taupe, taupe, taupe, taupe, taupe, taupe, taupe, taupe, // roof
      blue, blue, // back rectangle
      bottom, bottom, bottom, bottom, bottom, bottom, // base
      orange, orange, orange, // back face of cutout
      orange, orange, // top face of cutout
      orange, orange, orange // side face of cutout
    ];

    var baseBarn = new Barn("base", width, width * 1.4, width * 1.2, 0.4, baseBarnMaterials);
    var baseBarnBSP = new ThreeBSP(baseBarn);
    var entryway = new Box(width * 0.5, width * 0.5, width * 0.7);
    UTILS.setPosition(entryway, {x: width, y: width * 0.25, z: width * 1.05});
    var entrywayBSP = new ThreeBSP(entryway);
    var modBaseBarnBSP = baseBarnBSP.subtract(entrywayBSP);
    var modBaseBarn = modBaseBarnBSP.toMesh();
    modBaseBarn.geometry.computeFaceNormals();
    modBaseBarn.geometry.computeVertexNormals();
    modBaseBarn.geometry.faces.map(function(face, i) {
      face.materialIndex = i;
    });
    modBaseBarn.material = baseBarn.material;

    result.add(modBaseBarn);

    var roofMaterials = [];
    for (var i = 0; i < 32; i++)
      roofMaterials.push(roof);

    var baseRoof = new Roof("base", width*1.5, width*0.8, 2, .35, roofMaterials);
    UTILS.setPosition(baseRoof, { x: width*0.8, y: width*0.95, z: width*0.7 });
    UTILS.setRotation(baseRoof, { a: Math.PI, b: Math.PI/2, c: 0 });
    result.add(baseRoof);


    // ====================================================================================================
    // CROSS BARN
    // ====================================================================================================
    var crossBarnTopMaterials = [
      pink, pink, pink, // back
      yellow_shingles, yellow_shingles, yellow_shingles, // front
      blue, blue, // sides
      roof, roof, roof, roof, // roof
      pink, pink, // sides
      bottom, bottom // bottom
    ];

    var crossBarnTopObject = new THREE.Object3D();

    var crossBarnTop = new Barn("cross", 
      width * 0.4, width * 1.27, width * 0.6, 0.65, crossBarnTopMaterials);
    UTILS.setPosition(crossBarnTop, { x: -width * 0.15, y: width * 0.7, z: width * 0.58 });
    UTILS.setRotation(crossBarnTop, { a: 0, b: Math.PI / 2, c: 0 });
    crossBarnTopObject.add(crossBarnTop);

    var crossBarnTopWindow = new Window(width * 0.15, width * 0.27, width * 0.05, pink_c, skyBlue);
    UTILS.setPosition(crossBarnTopWindow, { x: width * 1.1, y: width * 0.85, z: width * 0.38 });
    crossBarnTopObject.add(crossBarnTopWindow);
    result.add(crossBarnTopObject);

    var crossGableCurve = new CrossGableCurve(width*0.1, width*0.2, width*0.4, bezier_texture);
    UTILS.setPosition(crossGableCurve, { x: width*1.12, y: width*0.55, z: width*0.18 });
    crossBarnTopObject.add(crossGableCurve);

    result.add(crossBarnTopObject);

    var crossRoof = new Roof("cross", width*1.4, width*0.7, 3, 0.65, roofMaterials);
    UTILS.setPosition(crossRoof, { x: width/2, y: width, z: width * 0.22 });
    crossBarnTopObject.add(crossRoof);

    var crossBarnBottomMaterials = [];
    for (var i = 0; i < 12; i++)
      crossBarnBottomMaterials.push(pink);
    crossBarnBottomMaterials[6] = bottom;
    crossBarnBottomMaterials[7] = bottom;

    var crossBarnBottomObject = new THREE.Object3D();

    var bayMaterials = [];
    for (var i = 0; i < 12; i++)
      bayMaterials.push(green);

    var bayStructure = new BayStructure(width*0.5, width*0.55, width*0.3, bayMaterials);
    UTILS.setPosition(bayStructure, { x: width, y: width*0.55, z: width * 0.12 });;
    UTILS.setRotation(bayStructure, { a: Math.PI/2, b: 0, c: Math.PI/2 })
    crossBarnBottomObject.add(bayStructure);

    // Pink back side of crossBarn. Needed because the height of the crossBarn is too small, since 
    // the crossBarn needs to accomodate the bay structure.
    var crossBarnBottom = new TexturedBox("cross", 
      width * 0.3, width * 0.86, width * 0.5, crossBarnBottomMaterials);
    UTILS.setPosition(crossBarnBottom, { x: 0, y: width * 0.43, z: width * 0.37 });
    crossBarnBottomObject.add(crossBarnBottom);

    var crossBarnBottomLeftWindow = new Window(width * 0.12, width * 0.2, width * 0.05, pink_c, skyBlue);
    UTILS.setPosition(crossBarnBottomLeftWindow, { x: width * 1.10, y: width * 0.35, z: width * 0.51 });
    UTILS.setRotation(crossBarnBottomLeftWindow, { a: 0, b: -Math.PI/3, c: 0 });
    crossBarnBottomObject.add(crossBarnBottomLeftWindow);

    var crossBarnBottomMiddleWindow = new Window(width * 0.12, width * 0.2, width * 0.05, pink_c, skyBlue);
    UTILS.setPosition(crossBarnBottomMiddleWindow, { x: width * 1.18, y: width * 0.35, z: width * 0.37 });
    crossBarnBottomObject.add(crossBarnBottomMiddleWindow);

    var crossBarnBottomRightWindow = new Window(width * 0.12, width * 0.2, width * 0.05, pink_c, skyBlue);
    UTILS.setPosition(crossBarnBottomRightWindow, { x: width * 1.09, y: width * 0.35, z: width * 0.23 });
    UTILS.setRotation(crossBarnBottomRightWindow, { a: 0, b: Math.PI/3, c: 0 });
    crossBarnBottomObject.add(crossBarnBottomRightWindow);

    result.add(crossBarnBottomObject);


    // ====================================================================================================
    // GABLE
    // ====================================================================================================
    var gableMaterials = [
      pink, pink, pink, // back
      yellow_panels, yellow_panels, yellow_panels, // front
      blue, blue, // sides
      roof, roof, roof, roof, // roof
      pink, pink, // sides
      bottom, bottom
    ];

    var gable = new Barn("gable", width * 0.26, width * 0.3, width * 0.37, 0.4, gableMaterials);
    UTILS.setPosition(gable, {x: width * 0.6, y: width * 0.8, z: width * 1.15});
    UTILS.setRotation(gable, {a: 0, b: Math.PI / 2, c: 0});
    result.add(gable);

    var smallRoof = new Roof("small", width * 0.4, width * 0.3, 2, 0.3, roofMaterials);
    UTILS.setPosition(smallRoof, { x: width * 0.76, y: width * 1.08, z: width * 0.93 });
    UTILS.setRotation(smallRoof, { a: Math.PI, b: 0, c: 0 });
    result.add(smallRoof);


    // ====================================================================================================
    // PORCH
    // ====================================================================================================
    var porchMaterials = [];
    for (var i = 0; i < 16; i++)
      porchMaterials.push(patio_floor);
    porchMaterials[6] = bottom;
    porchMaterials[7] = bottom;

    var porch = new TexturedBox("porch", width * 0.35, width * 0.15, width * 0.7, porchMaterials);
    UTILS.setPosition(porch, {x: width * 0.925, y: width * 0.075, z: width * 1.05});
    result.add(porch);


    // ====================================================================================================
    // POSTS FOR PORCH
    // ====================================================================================================
    var post1 = new Post(width * 0.02, width * 0.4, white);
    UTILS.setPosition(post1, {x: width * 0.96, y: width * 0.15, z: width * 1.35});
    result.add(post1);

    var post2 = new Post(width * 0.02, width * 0.4, white);
    UTILS.setPosition(post2, {x: width * 0.96, y: width * 0.15, z: width * 1.05});
    result.add(post2);


    // ====================================================================================================
    // WINDOWS
    // ====================================================================================================
    var gableWindow = new Window(width * 0.1, width * 0.14, width * 0.05, pink_c, skyBlue);
    UTILS.setPosition(gableWindow, {x: width * 0.88, y: width*0.99 , z: width*1.02});
    result.add(gableWindow);

    var porchWindow = new Window(width * 0.1, width * 0.14, width * 0.05, white, skyBlue);
    UTILS.setPosition(porchWindow, {x: width * 0.73, y: width * 0.35, z: width * 1.2});
    result.add(porchWindow);

    var topLeftWindow = new Window(width * 0.12, width * 0.2, width * 0.05, pink_c, skyBlue);
    UTILS.setPosition(topLeftWindow, {x: width * 0.5, y: width * 0.95, z: width * 1.38});
    UTILS.setRotation(topLeftWindow, {a: 0, b: Math.PI / 2, c: 0});
    result.add(topLeftWindow);

    var bottomLeftWindow = new Window(width * 0.08, width * 0.15, width * 0.05, pink_c, skyBlue);
    UTILS.setPosition(bottomLeftWindow, {x: width * 0.2, y: width * 0.5, z: width * 1.38});
    UTILS.setRotation(bottomLeftWindow, {a: 0, b: Math.PI / 2, c: 0});
    result.add(bottomLeftWindow);

    var bottomBackWindow = new Window(width * 0.12, width * 0.2, width * 0.05, pink_c, skyBlue);
    UTILS.setPosition(bottomBackWindow, {x: width * 0.02, y: width * 0.4, z: width * 1.18});
    UTILS.setRotation(bottomBackWindow, {a: Math.PI / 2, b: 0, c: 0});
    result.add(bottomBackWindow);

    var topBackWindow = new Window(width * 0.12, width * 0.2, width * 0.05, white, skyBlue);
    UTILS.setPosition(topBackWindow, {x: -width * 0.08, y: width * 0.95, z: width * 0.4});
    result.add(topBackWindow);


    // ====================================================================================================
    // DOORS
    // ====================================================================================================
    var frontDoor = new Door(width * 0.2, width * 0.3, width * 0.05, brick);
    UTILS.setPosition(frontDoor, {x: width * 0.73, y: width * 0.3, z: width * 0.85});
    result.add(frontDoor);

    var backDoor = new Door(width * 0.2, width * 0.3, width * 0.05, brick);
    UTILS.setPosition(backDoor, {x: width * 0.02, y: width * 0.3, z: width * 0.85});
    result.add(backDoor);


    // ====================================================================================================
    // STEPS
    // ====================================================================================================
    var stepsMaterial = [];
    for (var i = 0; i < 12; i++)
      stepsMaterial.push(patio_floor);
    stepsMaterial[6] = bottom;
    stepsMaterial[7] = bottom;

    var frontSteps = new Steps("steps",width * 0.4, width * 0.15, stepsMaterial);
    UTILS.setPosition(frontSteps, {x: width * 1.1, y: 0, z: width * 0.9});
    UTILS.setRotation(frontSteps, {a: 0, b: Math.PI / 2, c: 0});
    result.add(frontSteps);

    var backSteps = new Steps("steps", width * 0.4, width * 0.15, stepsMaterial);
    UTILS.setPosition(backSteps, {x: width * 0, y: 0, z: width * 0.9});
    UTILS.setRotation(backSteps, {a: 0, b: -Math.PI / 2, c: 0});
    result.add(backSteps);


    // ====================================================================================================
    // CHIMNEY
    // ====================================================================================================
    var chimneyMaterial = [];
    for (var i = 0; i < 12; i++)
      chimneyMaterial.push(chimney);

    var chimney = new Chimney("chimney", width * 0.15, width * 0.3, chimneyMaterial);
    UTILS.setPosition(chimney, {x: width * 0.5, y: width * 1.18, z: width * 0.65});
    result.add(chimney);


    // ====================================================================================================
    // BALLOON CLOUD
    // ====================================================================================================
    var balloonCloud = new BalloonCloud();
    UTILS.setPosition(balloonCloud, { x: width * 0.5, y: width * 1.35, z: width * 0.65 })
    result.add(balloonCloud);

    return result;
  }

  // Creates the cloud background on a plane geometry.
  function Background(material) {

      function _tc(geometry) {
        var UVs = [];

        fc(UVs, 2,0, 0,0, 2,1); fc(UVs, 0,0, 0,1, 2,1);

        geometry.faceVertexUvs = [ UVs ];
      }

    var geometry = new THREE.PlaneGeometry(2000, 3000, 0);

    _tc(geometry);

    var background = new THREE.Mesh(geometry, material);
    background.rotation.set(0, Math.PI / 2, Math.PI / 2);
    background.position.set(-100, -30, 0);

    return background;
  }

  // Creates the airplane to fly across the scene.
  function Plane(material) {
    var geometry = new THREE.PlaneGeometry(65, 30, 0);
    var plane = new THREE.Mesh(geometry, material);
    return plane;
  }

  return {
    House: House,
    Plane: Plane,
    Background: Background,
    getBoundingBox: PARAMS.getBoundingBox
  };
})();
