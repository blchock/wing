;
(function ($) {
    /**
     * A Three.js LOT Framework
     * addScene 创建场景
     * getScene 获取场景
     * resizeScene 自动调整场景大小
     * removeScene 销毁并删除场景
     */
    var Canvas = {};

    $.extend({
        /**
         * 添加场景
         * @param {*} name 场景名
         * @param {*} node 场景渲染节点
         * 返回场景对象 canvas 有以下方法：
         * getWorld 获取场景物理世界Cannon
         * start 启动世界（自动启动）
         * reload 重启世界
         * addTimer 添加计时器（以方便销毁时自动删除）
         * addVisual 添加3D对象
         * addVisuals 添加多个3D对象
         * removeVisual 删除3D对象
         * removeAllVisuals 删除所有3D对象
         * removeFromParent 销毁并删除场景
         * setRenderMode 设置渲染模式 "solid", "wireframe"
         * restartCurrentScene 重启当前场景
         * restartGeometryCaches 重启缓存
         * switchFPS 显示/隐藏FPS 参数可传 show,hide 不传则为自动切换
         * 有以下对象：
         * scene Three场景
         * stats 状态器
         * camera 主相机
         * controls 场景控制器
         * renderer 场景渲染器
         * settings 场景参数库
         * 
         */
        addScene: function (name, node) {
            var cv = {
                id: name,
                node: node,
                bodies: [],
                visuals: [],
                timers: [],
                world: new CANNON.World(),
                scene: new THREE.Scene(),
                stats: new Stats(),
                camera: null,
                controls: null,
                renderer: null,
                renderModes: ["solid", "wireframe"],
                settings: {
                    stepFrequency: 60,
                    quatNormalizeSkip: 2,
                    quatNormalizeFast: true,
                    gx: 0,
                    gy: 0,
                    gz: 0,
                    iterations: 3,
                    tolerance: 0.0001,
                    k: 1e6,
                    d: 3,
                    scene: 0,
                    paused: false,
                    rendermode: "solid",
                    constraints: false,
                    contacts: false,  // Contact points
                    cm2contact: false, // center of mass to contact points
                    normals: false, // contact normals
                    axes: false, // "local" frame axes
                    particleSize: 0.1,
                    shadows: false,
                    aabbs: false,
                    profiling: false,
                    maxSubSteps: 3
                }
            }
            cv.prototype = new CANNON.EventTarget();
            cv.world.broadphase = new CANNON.NaiveBroadphase();

            var three_contactpoint_geo = new THREE.SphereGeometry(0.1, 6, 6);
            cv.particleGeo = new THREE.SphereGeometry(1, 16, 8);

            // Material
            var materialColor = 0xdddddd;
            var solidMaterial = new THREE.MeshLambertMaterial({ color: materialColor });
            //THREE.ColorUtils.adjustHSV( solidMaterial.color, 0, 0, 0.9 );
            var wireframeMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, wireframe: true });
            cv.currentMaterial = solidMaterial;
            var contactDotMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
            var particleMaterial = cv.particleMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });


            var GeometryCache = function (createFunc) {
                var that = this, geometries = [], gone = [];
                this.request = function () {
                    if (geometries.length) {
                        geo = geometries.pop();
                    } else {
                        geo = createFunc();
                    }
                    cv.scene.add(geo);
                    gone.push(geo);
                    return geo;
                };

                this.restart = function () {
                    while (gone.length) {
                        geometries.push(gone.pop());
                    }
                };

                this.hideCached = function () {
                    for (var i = 0; i < geometries.length; i++) {
                        cv.scene.remove(geometries[i]);
                    }
                };
            }

            // Geometry caches
            var contactMeshCache = new GeometryCache(function () {
                return new THREE.Mesh(three_contactpoint_geo, contactDotMaterial);
            });
            var cm2contactMeshCache = new GeometryCache(function () {
                var geometry = new THREE.Geometry();
                geometry.vertices.push(new THREE.Vector3(0, 0, 0));
                geometry.vertices.push(new THREE.Vector3(1, 1, 1));
                return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xff0000 }));
            });
            var bboxGeometry = new THREE.BoxGeometry(1, 1, 1);
            var bboxMaterial = new THREE.MeshBasicMaterial({
                color: materialColor,
                wireframe: true
            });
            var bboxMeshCache = new GeometryCache(function () {
                return new THREE.Mesh(bboxGeometry, bboxMaterial);
            });
            var distanceConstraintMeshCache = new GeometryCache(function () {
                var geometry = new THREE.Geometry();
                geometry.vertices.push(new THREE.Vector3(0, 0, 0));
                geometry.vertices.push(new THREE.Vector3(1, 1, 1));
                return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xff0000 }));
            });
            var p2pConstraintMeshCache = new GeometryCache(function () {
                var geometry = new THREE.Geometry();
                geometry.vertices.push(new THREE.Vector3(0, 0, 0));
                geometry.vertices.push(new THREE.Vector3(1, 1, 1));
                return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xff0000 }));
            });
            var normalMeshCache = new GeometryCache(function () {
                var geometry = new THREE.Geometry();
                geometry.vertices.push(new THREE.Vector3(0, 0, 0));
                geometry.vertices.push(new THREE.Vector3(1, 1, 1));
                return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x00ff00 }));
            });
            var axesMeshCache = new GeometryCache(function () {
                var mesh = new THREE.Object3D();
                //mesh.useQuaternion = true;
                var origin = new THREE.Vector3(0, 0, 0);
                var gX = new THREE.Geometry();
                var gY = new THREE.Geometry();
                var gZ = new THREE.Geometry();
                gX.vertices.push(origin);
                gY.vertices.push(origin);
                gZ.vertices.push(origin);
                gX.vertices.push(new THREE.Vector3(1, 0, 0));
                gY.vertices.push(new THREE.Vector3(0, 1, 0));
                gZ.vertices.push(new THREE.Vector3(0, 0, 1));
                var lineX = new THREE.Line(gX, new THREE.LineBasicMaterial({ color: 0xff0000 }));
                var lineY = new THREE.Line(gY, new THREE.LineBasicMaterial({ color: 0x00ff00 }));
                var lineZ = new THREE.Line(gZ, new THREE.LineBasicMaterial({ color: 0x0000ff }));
                mesh.add(lineX);
                mesh.add(lineY);
                mesh.add(lineZ);
                return mesh;
            });

            cv.restartGeometryCaches = function () {
                contactMeshCache.restart();
                contactMeshCache.hideCached();

                cm2contactMeshCache.restart();
                cm2contactMeshCache.hideCached();

                distanceConstraintMeshCache.restart();
                distanceConstraintMeshCache.hideCached();

                normalMeshCache.restart();
                normalMeshCache.hideCached();
            }
            cv.start = function () {
                var num = cv.visuals.length;
                for (var i = 0; i < num; i++) {
                    cv.world.remove(cv.bodies.pop());
                    var mesh = cv.visuals.pop();
                    cv.scene.remove(mesh);
                }
                while (cv.world.constraints.length) {
                    cv.world.removeConstraint(cv.world.constraints[0]);
                }
                cv.settings.iterations = cv.world.solver.iterations;
                cv.settings.gx = cv.world.gravity.x + 0.0;
                cv.settings.gy = cv.world.gravity.y + 0.0;
                cv.settings.gz = cv.world.gravity.z + 0.0;
                cv.settings.quatNormalizeSkip = cv.world.quatNormalizeSkip;
                cv.settings.quatNormalizeFast = cv.world.quatNormalizeFast;
                cv.restartGeometryCaches();
            }
            cv.reload = function () {
                cv.dispatchEvent({ type: 'destroy' });
                cv.settings.paused = false;
                // updategui();
                cv.start();
            }

            ///////////////////////////// init Scenes /////////////////////////////
            var SHADOW_MAP_WIDTH = 512;
            var SHADOW_MAP_HEIGHT = 512;
            var MARGIN = 0;
            var SCREEN_WIDTH = cv.node.offsetWidth; // window.innerWidth;
            var SCREEN_HEIGHT = cv.node.offsetHeight - 2 * MARGIN; // window.innerHeight - 2 * MARGIN;
            cv.orgWidth = cv.node.offsetWidth
            cv.orgHeight = cv.node.offsetHeight
            var container;
            var NEAR = 5, FAR = 2000;
            var sceneHUD, cameraOrtho, hudMaterial;
            var mouseX = 0, mouseY = 0;
            var windowHalfX = cv.node.offsetWidth / 2;
            var windowHalfY = cv.node.offsetHeight / 2;
            var container = cv.node;
            var light, ambient;

            // Camera
            cv.camera = new THREE.PerspectiveCamera(24, SCREEN_WIDTH / SCREEN_HEIGHT, NEAR, FAR);

            cv.camera.up.set(0, 0, 1);
            cv.camera.position.set(0, 30, 20);

            // SCENE
            cv.scene.fog = new THREE.Fog(0x222222, 1000, FAR);

            // LIGHTS
            ambient = new THREE.AmbientLight(0x222222);
            cv.scene.add(ambient);

            light = new THREE.SpotLight(0xffffff);
            light.position.set(30, 30, 40);
            light.target.position.set(0, 0, 0);

            light.castShadow = true;

            light.shadowCameraNear = 10;
            light.shadowCameraFar = 100;//cv.camera.far;
            light.shadowCameraFov = 30;

            light.shadowMapBias = 0.0039;
            light.shadowMapDarkness = 0.5;
            light.shadowMapWidth = SHADOW_MAP_WIDTH;
            light.shadowMapHeight = SHADOW_MAP_HEIGHT;

            //light.shadowCameraVisible = true;

            cv.scene.add(light);
            cv.scene.add(cv.camera);

            // RENDERER
            cv.renderer = new THREE.WebGLRenderer({ clearColor: 0x000000, clearAlpha: 1, antialias: false });
            cv.renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
            cv.renderer.domElement.style.position = "relative";
            cv.renderer.domElement.style.top = MARGIN + 'px';
            container.appendChild(cv.renderer.domElement);

            // // Add info
            // info = document.createElement('div');
            // info.style.position = 'absolute';
            // info.style.top = '10px';
            // info.style.width = '100%';
            // info.style.textAlign = 'center';
            // info.innerHTML = cv.name;
            // container.appendChild(info);

            function onDocumentMouseMove(event) {
                mouseX = (event.clientX - windowHalfX);
                mouseY = (event.clientY - windowHalfY);
            }

            document.addEventListener('mousemove', onDocumentMouseMove);
            // window.addEventListener('resize', onWindowResize);

            cv.renderer.setClearColor(cv.scene.fog.color, 1);
            cv.renderer.autoClear = false;

            cv.renderer.shadowMapEnabled = true;
            cv.renderer.shadowMapSoft = true;

            // Smoothie
            smoothieCanvas = document.createElement("canvas");
            smoothieCanvas.width = SCREEN_WIDTH;
            smoothieCanvas.height = SCREEN_HEIGHT;
            smoothieCanvas.style.opacity = 0.5;
            smoothieCanvas.style.position = 'absolute';
            smoothieCanvas.style.top = '0px';
            smoothieCanvas.style.zIndex = 90;
            container.appendChild(smoothieCanvas);
            smoothie = new SmoothieChart({
                labelOffsetY: 50,
                maxDataSetLength: 100,
                millisPerPixel: 2,
                grid: {
                    strokeStyle: 'none',
                    fillStyle: 'none',
                    lineWidth: 1,
                    millisPerLine: 250,
                    verticalSections: 6
                },
                labels: {
                    fillStyle: 'rgb(180, 180, 180)'
                }
            });
            smoothie.streamTo(smoothieCanvas);
            // Create time series for each profile label
            var lines = {};
            var colors = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [255, 0, 255], [0, 255, 255]];
            var i = 0;
            for (var label in cv.world.profile) {
                var c = colors[i % colors.length];
                lines[label] = new TimeSeries({
                    label: label,
                    fillStyle: "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")",
                    maxDataLength: 500,
                });
                i++;
            }

            // Add a random value to each line every second
            cv.world.addEventListener("postStep", function (evt) {
                for (var label in cv.world.profile)
                    lines[label].append(cv.world.time * 1000, cv.world.profile[label]);
            });

            // Add to SmoothieChart
            var i = 0;
            for (var label in cv.world.profile) {
                var c = colors[i % colors.length];
                smoothie.addTimeSeries(lines[label], {
                    strokeStyle: "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")",
                    //fillStyle:"rgba("+c[0]+","+c[1]+","+c[2]+",0.3)",
                    lineWidth: 2
                });
                i++;
            }
            cv.world.doProfiling = false;
            smoothie.stop();
            smoothieCanvas.style.display = "none";

            // STATS
            cv.stats.domElement.style.position = 'absolute';
            cv.stats.domElement.style.top = '0px';
            cv.stats.domElement.style.zIndex = 100;
            container.appendChild(cv.stats.domElement);

            // Trackball controls
            cv.controls = new THREE.TrackballControls(cv.camera, cv.node.offsetParent); // cv.renderer.domElement
            cv.controls.rotateSpeed = 1.0;
            cv.controls.zoomSpeed = 1.2;
            cv.controls.panSpeed = 0.2;
            cv.controls.noZoom = false;
            cv.controls.noPan = false;
            cv.controls.staticMoving = false;
            cv.controls.dynamicDampingFactor = 0.3;
            var radius = 100;
            cv.controls.minDistance = 0.0;
            cv.controls.maxDistance = radius * 1000;
            //cv.controls.keys = [ 65, 83, 68 ]; // [ rotateKey, zoomKey, panKey ]
            cv.controls.screen.width = SCREEN_WIDTH;
            cv.controls.screen.height = SCREEN_HEIGHT;

            /////////////////////////////////////////////////////////////////////////////

            cv.getWorld = function () {
                return cv.world;
            };

            cv.addVisual = function (body) {
                // What geometry should be used?
                var mesh;
                if (body instanceof CANNON.Body) {
                    mesh = cv.shape2mesh(body);
                }
                if (mesh) {
                    // Add body
                    cv.bodies.push(body);
                    cv.visuals.push(mesh);
                    body.visualref = mesh;
                    body.visualref.visualId = cv.bodies.length - 1;
                    //mesh.useQuaternion = true;
                    cv.scene.add(mesh);
                }
            };

            cv.addVisuals = function (bodies) {
                for (var i = 0; i < bodies.length; i++) {
                    cv.addVisual(bodies[i]);
                }
            };

            cv.removeVisual = function (body) {
                if (body.visualref) {
                    var bodies = cv.bodies,
                        visuals = cv.visuals,
                        old_b = [],
                        old_v = [],
                        n = bodies.length;

                    for (var i = 0; i < n; i++) {
                        old_b.unshift(bodies.pop());
                        old_v.unshift(visuals.pop());
                    }

                    var id = body.visualref.visualId;
                    for (var j = 0; j < old_b.length; j++) {
                        if (j !== id) {
                            var i = j > id ? j - 1 : j;
                            bodies[i] = old_b[j];
                            visuals[i] = old_v[j];
                            bodies[i].visualref = old_b[j].visualref;
                            bodies[i].visualref.visualId = i;
                        }
                    }
                    body.visualref.visualId = null;
                    cv.scene.remove(body.visualref);
                    body.visualref = null;
                }
            };

            cv.removeAllVisuals = function () {
                while (cv.bodies.length) {
                    cv.removeVisual(cv.bodies[0]);
                }
            };

            cv.shape2mesh = function (body) {
                var wireframe = cv.settings.renderMode === "wireframe";
                var obj = new THREE.Object3D();

                for (var l = 0; l < body.shapes.length; l++) {
                    var shape = body.shapes[l];

                    var mesh;

                    switch (shape.type) {

                        case CANNON.Shape.types.SPHERE:
                            var sphere_geometry = new THREE.SphereGeometry(shape.radius, 8, 8);
                            mesh = new THREE.Mesh(sphere_geometry, cv.currentMaterial);
                            break;

                        case CANNON.Shape.types.PARTICLE:
                            mesh = new THREE.Mesh(cv.particleGeo, cv.particleMaterial);
                            var s = cv.settings;
                            mesh.scale.set(s.particleSize, s.particleSize, s.particleSize);
                            break;

                        case CANNON.Shape.types.PLANE:
                            var geometry = new THREE.PlaneGeometry(10, 10, 4, 4);
                            mesh = new THREE.Object3D();
                            var submesh = new THREE.Object3D();
                            var ground = new THREE.Mesh(geometry, cv.currentMaterial);
                            ground.scale.set(100, 100, 100);
                            submesh.add(ground);

                            ground.castShadow = true;
                            ground.receiveShadow = true;

                            mesh.add(submesh);
                            break;

                        case CANNON.Shape.types.BOX:
                            var box_geometry = new THREE.BoxGeometry(shape.halfExtents.x * 2,
                                shape.halfExtents.y * 2,
                                shape.halfExtents.z * 2);
                            mesh = new THREE.Mesh(box_geometry, cv.currentMaterial);
                            break;

                        case CANNON.Shape.types.CONVEXPOLYHEDRON:
                            var geo = new THREE.Geometry();

                            // Add vertices
                            for (var i = 0; i < shape.vertices.length; i++) {
                                var v = shape.vertices[i];
                                geo.vertices.push(new THREE.Vector3(v.x, v.y, v.z));
                            }

                            for (var i = 0; i < shape.faces.length; i++) {
                                var face = shape.faces[i];

                                // add triangles
                                var a = face[0];
                                for (var j = 1; j < face.length - 1; j++) {
                                    var b = face[j];
                                    var c = face[j + 1];
                                    geo.faces.push(new THREE.Face3(a, b, c));
                                }
                            }
                            geo.computeBoundingSphere();
                            geo.computeFaceNormals();
                            mesh = new THREE.Mesh(geo, cv.currentMaterial);
                            break;

                        case CANNON.Shape.types.HEIGHTFIELD:
                            var geometry = new THREE.Geometry();

                            var v0 = new CANNON.Vec3();
                            var v1 = new CANNON.Vec3();
                            var v2 = new CANNON.Vec3();
                            for (var xi = 0; xi < shape.data.length - 1; xi++) {
                                for (var yi = 0; yi < shape.data[xi].length - 1; yi++) {
                                    for (var k = 0; k < 2; k++) {
                                        shape.getConvexTrianglePillar(xi, yi, k === 0);
                                        v0.copy(shape.pillarConvex.vertices[0]);
                                        v1.copy(shape.pillarConvex.vertices[1]);
                                        v2.copy(shape.pillarConvex.vertices[2]);
                                        v0.vadd(shape.pillarOffset, v0);
                                        v1.vadd(shape.pillarOffset, v1);
                                        v2.vadd(shape.pillarOffset, v2);
                                        geometry.vertices.push(
                                            new THREE.Vector3(v0.x, v0.y, v0.z),
                                            new THREE.Vector3(v1.x, v1.y, v1.z),
                                            new THREE.Vector3(v2.x, v2.y, v2.z)
                                        );
                                        var i = geometry.vertices.length - 3;
                                        geometry.faces.push(new THREE.Face3(i, i + 1, i + 2));
                                    }
                                }
                            }
                            geometry.computeBoundingSphere();
                            geometry.computeFaceNormals();
                            mesh = new THREE.Mesh(geometry, cv.currentMaterial);
                            break;

                        case CANNON.Shape.types.TRIMESH:
                            var geometry = new THREE.Geometry();

                            var v0 = new CANNON.Vec3();
                            var v1 = new CANNON.Vec3();
                            var v2 = new CANNON.Vec3();
                            for (var i = 0; i < shape.indices.length / 3; i++) {
                                shape.getTriangleVertices(i, v0, v1, v2);
                                geometry.vertices.push(
                                    new THREE.Vector3(v0.x, v0.y, v0.z),
                                    new THREE.Vector3(v1.x, v1.y, v1.z),
                                    new THREE.Vector3(v2.x, v2.y, v2.z)
                                );
                                var j = geometry.vertices.length - 3;
                                geometry.faces.push(new THREE.Face3(j, j + 1, j + 2));
                            }
                            geometry.computeBoundingSphere();
                            geometry.computeFaceNormals();
                            mesh = new THREE.Mesh(geometry, cv.currentMaterial);
                            break;

                        default:
                            throw "Visual type not recognized: " + shape.type;
                    }

                    mesh.receiveShadow = true;
                    mesh.castShadow = true;
                    if (mesh.children) {
                        for (var i = 0; i < mesh.children.length; i++) {
                            mesh.children[i].castShadow = true;
                            mesh.children[i].receiveShadow = true;
                            if (mesh.children[i]) {
                                for (var j = 0; j < mesh.children[i].length; j++) {
                                    mesh.children[i].children[j].castShadow = true;
                                    mesh.children[i].children[j].receiveShadow = true;
                                }
                            }
                        }
                    }

                    var o = body.shapeOffsets[l];
                    var q = body.shapeOrientations[l];
                    mesh.position.set(o.x, o.y, o.z);
                    mesh.quaternion.set(q.x, q.y, q.z, q.w);

                    obj.add(mesh);
                }

                return obj;
            };

            cv.setRenderMode = function (mode) {
                if (cv.renderModes.indexOf(mode) === -1) {
                    throw new Error("Render mode " + mode + " not found!");
                }

                switch (mode) {
                    case "solid":
                        cv.currentMaterial = solidMaterial;
                        light.intensity = 1;
                        ambient.color.setHex(0x222222);
                        break;
                    case "wireframe":
                        cv.currentMaterial = wireframeMaterial;
                        light.intensity = 0;
                        ambient.color.setHex(0xffffff);
                        break;
                }

                function setMaterial(node, mat) {
                    if (node.material) {
                        node.material = mat;
                    }
                    for (var i = 0; i < node.children.length; i++) {
                        setMaterial(node.children[i], mat);
                    }
                }
                for (var i = 0; i < cv.visuals.length; i++) {
                    setMaterial(cv.visuals[i], cv.currentMaterial);
                }
                cv.settings.rendermode = mode;
            }

            /**
             * Restarts the current scene
             * @method restartCurrentScene
             */
            cv.restartCurrentScene = function () {
                var N = cv.bodies.length;
                for (var i = 0; i < N; i++) {
                    var b = cv.bodies[i];
                    b.position.copy(b.initPosition);
                    b.velocity.copy(b.initVelocity);
                    if (b.initAngularVelocity) {
                        b.angularVelocity.copy(b.initAngularVelocity);
                        b.quaternion.copy(b.initQuaternion);
                    }
                }
            }
            cv.addTimer = function(timer) {
                cv.timers.push(timer);
            }
            cv.removeFromParent = function () {
                cv.settings.paused = true;
                cv.world.dispatchEvent({ type: 'destroy' });
                cancelAnimationFrame(cv.animId); // Stop the animation
                cv.renderer.domElement.addEventListener('dblclick', null, false); //remove listener to render
                for (var tm in cv.timers) {
                    clearInterval(cv.timers[tm]);
                }
                cv.removeAllVisuals();
                cv.scene = null;
                cv.camera = null;
                cv.controls = null;
                $(cv.node).empty();
                Canvas[cv.id] = undefined;
            }
            function makeSureNotZero(vec) {
                if (vec.x === 0.0) {
                    vec.x = 1e-6;
                }
                if (vec.y === 0.0) {
                    vec.y = 1e-6;
                }
                if (vec.z === 0.0) {
                    vec.z = 1e-6;
                }
            }


            function updateVisuals() {
                var N = cv.bodies.length;

                // Read position data into visuals
                for (var i = 0; i < N; i++) {
                    var b = cv.bodies[i], visual = cv.visuals[i];
                    visual.position.copy(b.position);
                    if (b.quaternion) {
                        visual.quaternion.copy(b.quaternion);
                    }
                }

                // Render contacts
                contactMeshCache.restart();
                if (cv.settings.contacts) {
                    // if ci is even - use body i, else j
                    for (var ci = 0; ci < cv.world.contacts.length; ci++) {
                        for (var ij = 0; ij < 2; ij++) {
                            var mesh = contactMeshCache.request(),
                                c = cv.world.contacts[ci],
                                b = ij === 0 ? c.bi : c.bj,
                                r = ij === 0 ? c.ri : c.rj;
                            mesh.position.set(b.position.x + r.x, b.position.y + r.y, b.position.z + r.z);
                        }
                    }
                }
                contactMeshCache.hideCached();

                // Lines from center of mass to contact point
                cm2contactMeshCache.restart();
                if (cv.settings.cm2contact) {
                    for (var ci = 0; ci < cv.world.contacts.length; ci++) {
                        for (var ij = 0; ij < 2; ij++) {
                            var line = cm2contactMeshCache.request(),
                                c = cv.world.contacts[ci],
                                b = ij === 0 ? c.bi : c.bj,
                                r = ij === 0 ? c.ri : c.rj;
                            line.scale.set(r.x, r.y, r.z);
                            makeSureNotZero(line.scale);
                            line.position.copy(b.position);
                        }
                    }
                }
                cm2contactMeshCache.hideCached();

                distanceConstraintMeshCache.restart();
                p2pConstraintMeshCache.restart();
                if (cv.settings.constraints) {
                    // Lines for distance constraints
                    for (var ci = 0; ci < cv.world.constraints.length; ci++) {
                        var c = cv.world.constraints[ci];
                        if (!(c instanceof CANNON.DistanceConstraint)) {
                            continue;
                        }

                        var nc = c.equations.normal;

                        var bi = nc.bi, bj = nc.bj, line = distanceConstraintMeshCache.request();
                        var i = bi.id, j = bj.id;

                        // Remember, bj is either a Vec3 or a Body.
                        var v;
                        if (bj.position) {
                            v = bj.position;
                        } else {
                            v = bj;
                        }
                        line.scale.set(v.x - bi.position.x,
                            v.y - bi.position.y,
                            v.z - bi.position.z);
                        makeSureNotZero(line.scale);
                        line.position.copy(bi.position);
                    }


                    // Lines for distance constraints
                    for (var ci = 0; ci < cv.world.constraints.length; ci++) {
                        var c = cv.world.constraints[ci];
                        if (!(c instanceof CANNON.PointToPointConstraint)) {
                            continue;
                        }
                        var n = c.equations.normal;
                        var bi = n.bi, bj = n.bj, relLine1 = p2pConstraintMeshCache.request(), relLine2 = p2pConstraintMeshCache.request(), diffLine = p2pConstraintMeshCache.request();
                        var i = bi.id, j = bj.id;

                        relLine1.scale.set(n.ri.x, n.ri.y, n.ri.z);
                        relLine2.scale.set(n.rj.x, n.rj.y, n.rj.z);
                        diffLine.scale.set(-n.penetrationVec.x, -n.penetrationVec.y, -n.penetrationVec.z);
                        makeSureNotZero(relLine1.scale);
                        makeSureNotZero(relLine2.scale);
                        makeSureNotZero(diffLine.scale);
                        relLine1.position.copy(bi.position);
                        relLine2.position.copy(bj.position);
                        n.bj.position.vadd(n.rj, diffLine.position);
                    }
                }
                p2pConstraintMeshCache.hideCached();
                distanceConstraintMeshCache.hideCached();

                // Normal lines
                normalMeshCache.restart();
                if (cv.settings.normals) {
                    for (var ci = 0; ci < cv.world.contacts.length; ci++) {
                        var c = cv.world.contacts[ci];
                        var bi = c.bi, bj = c.bj, line = normalMeshCache.request();
                        var i = bi.id, j = bj.id;
                        var n = c.ni;
                        var b = bi;
                        line.scale.set(n.x, n.y, n.z);
                        makeSureNotZero(line.scale);
                        line.position.copy(b.position);
                        c.ri.vadd(line.position, line.position);
                    }
                }
                normalMeshCache.hideCached();

                // Frame axes for each body
                axesMeshCache.restart();
                if (cv.settings.axes) {
                    for (var bi = 0; bi < cv.bodies.length; bi++) {
                        var b = cv.bodies[bi], mesh = axesMeshCache.request();
                        mesh.position.copy(b.position);
                        if (b.quaternion) {
                            mesh.quaternion.copy(b.quaternion);
                        }
                    }
                }
                axesMeshCache.hideCached();

                // AABBs
                bboxMeshCache.restart();
                if (cv.settings.aabbs) {
                    for (var i = 0; i < cv.bodies.length; i++) {
                        var b = cv.bodies[i];
                        if (b.computeAABB) {

                            if (b.aabbNeedsUpdate) {
                                b.computeAABB();
                            }

                            // Todo: cap the infinite AABB to scene AABB, for now just dont render
                            if (isFinite(b.aabb.lowerBound.x) &&
                                isFinite(b.aabb.lowerBound.y) &&
                                isFinite(b.aabb.lowerBound.z) &&
                                isFinite(b.aabb.upperBound.x) &&
                                isFinite(b.aabb.upperBound.y) &&
                                isFinite(b.aabb.upperBound.z) &&
                                b.aabb.lowerBound.x - b.aabb.upperBound.x != 0 &&
                                b.aabb.lowerBound.y - b.aabb.upperBound.y != 0 &&
                                b.aabb.lowerBound.z - b.aabb.upperBound.z != 0) {
                                var mesh = bboxMeshCache.request();
                                mesh.scale.set(b.aabb.lowerBound.x - b.aabb.upperBound.x,
                                    b.aabb.lowerBound.y - b.aabb.upperBound.y,
                                    b.aabb.lowerBound.z - b.aabb.upperBound.z);
                                mesh.position.set((b.aabb.lowerBound.x + b.aabb.upperBound.x) * 0.5,
                                    (b.aabb.lowerBound.y + b.aabb.upperBound.y) * 0.5,
                                    (b.aabb.lowerBound.z + b.aabb.upperBound.z) * 0.5);
                            }
                        }
                    }
                }
                bboxMeshCache.hideCached();
            }

            var lastCallTime = 0;
            function updatePhysics() {
                // Step cv.world
                var timeStep = 1 / cv.settings.stepFrequency;

                var now = Date.now() / 1000;

                if (!lastCallTime) {
                    // last call time not saved, cant guess elapsed time. Take a simple step.
                    cv.world.step(timeStep);
                    lastCallTime = now;
                    return;
                }

                var timeSinceLastCall = now - lastCallTime;

                cv.world.step(timeStep, timeSinceLastCall, cv.settings.maxSubSteps);

                lastCallTime = now;
            }

            cv.render = function () {
                cv.controls.update();
                cv.renderer.clear();
                cv.renderer.render(cv.scene, cv.camera);
            }
            cv.animate = function () {
                cv.animId = requestAnimationFrame(cv.animate);
                if (!cv.settings.paused) {
                    updateVisuals();
                    updatePhysics();
                }
                cv.render();
                cv.stats.update();
            }
            cv.animate();
            cv.switchFPS = function (show) {
                if (show === "show") {
                    cv.stats.domElement.style.display = "block";
                } else if (show === "hide") {
                    cv.stats.domElement.style.display = "none";
                } else {
                    if (cv.stats.domElement.style.display == "none") {
                        cv.stats.domElement.style.display = "block";
                    } else {
                        cv.stats.domElement.style.display = "none";
                    }
                }
            }
            Canvas[name] = cv
            return Canvas[name];
        },
        /**
         * 获取场景
         * @param {*} name 场景名
         */
        getScene: function (name) {
            if (name) return Canvas[name];
            else {
                for (var key in Canvas) {
                    return Canvas[key];
                }
            }
        },
        /**
         * 移除场景
         * @param {*} name 场景名
         */
        removeScene: function (name) {
            var scene = $.getScene(name);
            scene.removeFromParent();
        },
        /**
         * 自动调整场景大小
         * @param {*} name 场景名
         */
        resizeScene: function (name) {
            var cv = Canvas[name]
            if (cv) {
                var SCREEN_WIDTH = cv.node.offsetWidth;
                var SCREEN_HEIGHT = cv.node.offsetHeight;
                cv.renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);
                cv.camera.aspect = SCREEN_WIDTH / SCREEN_HEIGHT;
                cv.camera.updateProjectionMatrix();
                cv.controls.screen.width = SCREEN_WIDTH;
                cv.controls.screen.height = SCREEN_HEIGHT;
                var sp = SCREEN_WIDTH / cv.orgWidth * 1
                cv.controls.rotateSpeed = sp > 1 ? 1 : sp
                cv.camera.radius = (SCREEN_WIDTH + SCREEN_HEIGHT) / 4;
            }
        }
    });
}) (jQuery);