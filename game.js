(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const canvas = $("game");
  const engine = new BABYLON.Engine(canvas, true, {antialias:true, stencil:true, preserveDrawingBuffer:false});
  engine.setHardwareScalingLevel(Math.min(1.35, window.devicePixelRatio || 1));

  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.67,0.80,0.94,1);
  scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.0034;
  scene.fogColor = new BABYLON.Color3(0.72,0.82,0.93);
  scene.collisionsEnabled = true;

  const camera = new BABYLON.ArcRotateCamera("camera", -Math.PI/2, 1.03, 8.3, new BABYLON.Vector3(0,1.35,0), scene);
  camera.lowerRadiusLimit = 5.2;
  camera.upperRadiusLimit = 10.8;
  camera.lowerBetaLimit = 0.62;
  camera.upperBetaLimit = 1.28;
  camera.attachControl(canvas,true);
  camera.inputs.attached.pointers.buttons=[2];
  camera.checkCollisions=true;
  camera.collisionRadius=new BABYLON.Vector3(.45,.45,.45);

  const hemi = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(.2,1,.1), scene);
  hemi.intensity=.82;
  hemi.diffuse=new BABYLON.Color3(.88,.93,1);
  hemi.groundColor=new BABYLON.Color3(.22,.19,.15);

  const sun = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-.6,-1,.28), scene);
  sun.position=new BABYLON.Vector3(30,45,-25);
  sun.intensity=1.55;
  sun.diffuse=new BABYLON.Color3(1,.94,.82);

  const shadows=new BABYLON.ShadowGenerator(2048,sun);
  shadows.useBlurExponentialShadowMap=true;
  shadows.blurKernel=22;
  shadows.darkness=.28;

  const pipeline=new BABYLON.DefaultRenderingPipeline("pipeline",true,scene,[camera]);
  pipeline.fxaaEnabled=true;
  pipeline.samples=2;
  pipeline.bloomEnabled=true;
  pipeline.bloomThreshold=.9;
  pipeline.bloomWeight=.16;
  pipeline.bloomKernel=48;
  pipeline.imageProcessingEnabled=true;
  pipeline.imageProcessing.contrast=1.16;
  pipeline.imageProcessing.exposure=1.08;
  pipeline.imageProcessing.toneMappingEnabled=true;
  pipeline.imageProcessing.toneMappingType=BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;

  function mat(name,hex,rough=.85,metal=0,emit=null){
    const m=new BABYLON.PBRMaterial(name,scene);
    m.albedoColor=BABYLON.Color3.FromHexString(hex);
    m.roughness=rough; m.metallic=metal;
    if(emit)m.emissiveColor=BABYLON.Color3.FromHexString(emit);
    return m;
  }
  const M={
    grass:mat('grass','#5f7f49',1), grass2:mat('grass2','#789958',1), dirt:mat('dirt','#8c7354',1),
    stone:mat('stone','#7a7b78',.98), stoneD:mat('stoneD','#5c5e5c',1), plaster:mat('plaster','#c7baa3',.96),
    timber:mat('timber','#4c3424',.94), wood:mat('wood','#6a4932',.96), roof:mat('roof','#5b423b',.95),
    leafA:mat('leafA','#4d6b3d',1),leafB:mat('leafB','#69864d',1),leafC:mat('leafC','#385437',1),
    skin:mat('skin','#c79374',.9),tunic:mat('tunic','#4f734a',.88),leather:mat('leather','#5b3c27',.93),
    pants:mat('pants','#423d35',.95),hair:mat('hair','#56351f',.9),blue:mat('blue','#4f87bd',.35,0,'#2f73b9'),
    gold:mat('gold','#aa8449',.45,.15),water:mat('water','#6d9fb8',.25,0,'#244f68'),npc:mat('npc','#875a48',.9)
  };

  function h(x,z){
    const a=Math.sin(x*.055)*.5+Math.cos(z*.05)*.42;
    const b=Math.sin((x+z)*.031)*.72+Math.cos((x-z)*.026)*.32;
    const flat=Math.max(0,1-Math.hypot(x*.07,(z+2)*.07));
    return a+b*(1-flat*.62);
  }
  const ground=BABYLON.MeshBuilder.CreateGround('terrain',{width:130,height:130,subdivisions:96,updatable:true},scene);
  const pos=ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
  for(let i=0;i<pos.length;i+=3)pos[i+1]=h(pos[i],pos[i+2]);
  ground.updateVerticesData(BABYLON.VertexBuffer.PositionKind,pos);
  ground.convertToFlatShadedMesh();
  ground.material=M.grass;ground.receiveShadows=true;ground.checkCollisions=true;

  function place(mesh,x,z,y=0){mesh.position.set(x,h(x,z)+y,z);return mesh;}
  const roads=[{x:0,z:1,w:6,d:44},{x:15,z:-8,w:32,d:4.8},{x:-10,z:-5,w:4.5,d:19}];
  const onRoad=(x,z)=>roads.some(r=>Math.abs(x-r.x)<r.w/2&&Math.abs(z-r.z)<r.d/2);
  const village=(x,z)=>Math.abs(x)<19&&z>-25&&z<21;

  function patch(x,z,w,d,m,y=.05){const p=BABYLON.MeshBuilder.CreateBox('patch',{width:w,depth:d,height:.08},scene);place(p,x,z,y);p.material=m;p.receiveShadows=true;return p;}
  patch(0,1,6.6,44.5,M.dirt);patch(15,-8,32.5,5.3,M.dirt);patch(-10,-5,5,19.5,M.dirt);

  function cobbles(x,z,w,d){
    const sx=.78,sz=.76;
    for(let px=x-w/2+.45;px<x+w/2-.35;px+=sx){
      for(let pz=z-d/2+.42;pz<z+d/2-.35;pz+=sz){
        const s=BABYLON.MeshBuilder.CreateBox('c',{width:.62+Math.random()*.16,depth:.6+Math.random()*.16,height:.11+Math.random()*.06},scene);
        place(s,px+(Math.random()-.5)*.12,pz+(Math.random()-.5)*.12,.07);s.rotation.y=(Math.random()-.5)*.18;s.material=Math.random()<.35?M.stoneD:M.stone;s.receiveShadows=true;
      }
    }
  }
  cobbles(0,.5,5.3,30);cobbles(.2,-14.5,9,7.5);cobbles(15,-8,19,3.5);

  function rock(x,z,s=1){
    const r=BABYLON.MeshBuilder.CreatePolyhedron('rock',{type:1,size:.9*s},scene);place(r,x,z,.42*s);r.scaling.set(.8+Math.random()*.35,.55+Math.random()*.3,.8+Math.random()*.35);r.rotation.set(Math.random(),Math.random()*Math.PI,Math.random());r.material=Math.random()<.5?M.stone:M.stoneD;r.checkCollisions=true;r.receiveShadows=true;shadows.addShadowCaster(r);return r;
  }
  [[-18,-14,1.5],[-16,0,1.2],[17,4,1.4],[20,-17,1.2],[25,-5,1.6],[9,21,1],[-26,11,1.7],[28,12,1.3],[33,-12,1.5],[-29,-21,1.9],[13,-27,1.4]].forEach(v=>rock(...v));

  function building(name,x,z,o={}){
    const root=new BABYLON.TransformNode(name,scene);root.position.set(x,h(x,z),z);root.rotation.y=o.rot||0;
    const w=o.w||4.6,d=o.d||4,hgt=o.h||2.8;
    const f=BABYLON.MeshBuilder.CreateBox(name+'f',{width:w+.7,depth:d+.7,height:.75},scene);f.parent=root;f.position.y=.375;f.material=M.stone;f.checkCollisions=true;f.receiveShadows=true;
    const b=BABYLON.MeshBuilder.CreateBox(name+'b',{width:w,depth:d,height:hgt},scene);b.parent=root;b.position.y=hgt/2+.75;b.material=M.plaster;b.checkCollisions=true;b.receiveShadows=true;
    const roof=BABYLON.MeshBuilder.CreateCylinder(name+'r',{height:d+1,diameter:w+1.2,tessellation:3},scene);roof.parent=root;roof.rotation.z=Math.PI/2;roof.rotation.y=Math.PI/2;roof.position.y=hgt+1.65;roof.material=M.roof;
    const door=BABYLON.MeshBuilder.CreateBox(name+'door',{width:1,height:1.9,depth:.14},scene);door.parent=root;door.position.set(0,1.7,-d/2-.02);door.material=M.timber;
    const porch=BABYLON.MeshBuilder.CreateBox(name+'porch',{width:2,depth:1.2,height:.18},scene);porch.parent=root;porch.position.set(0,.85,-d/2-.58);porch.material=M.wood;
    const posts=[];[-.82,.82].forEach(px=>{const p=BABYLON.MeshBuilder.CreateCylinder(name+'p',{height:1.7,diameter:.14},scene);p.parent=root;p.position.set(px,1.55,-d/2-.58);p.material=M.timber;posts.push(p)});
    [1.5,hgt+.48].forEach(y=>{
      const bf=BABYLON.MeshBuilder.CreateBox(name+'bf'+y,{width:w+.1,height:.15,depth:.18},scene);bf.parent=root;bf.position.set(0,y,-d/2-.02);bf.material=M.timber;
      const bb=bf.clone(name+'bb'+y);bb.parent=root;bb.position.z=d/2+.02;
    });
    [-w/2+.25,0,w/2-.25].forEach(px=>{
      const v=BABYLON.MeshBuilder.CreateBox(name+'v'+px,{width:.14,height:hgt,depth:.18},scene);v.parent=root;v.position.set(px,hgt/2+.75,-d/2-.02);v.material=M.timber;
      const vb=v.clone(name+'vb'+px);vb.parent=root;vb.position.z=d/2+.02;
    });
    [-1.25,1.25].forEach((px,i)=>{
      px*=w/4.6;
      const fr=BABYLON.MeshBuilder.CreateBox(name+'fr'+i,{width:.84,height:.96,depth:.1},scene);fr.parent=root;fr.position.set(px,2,-d/2-.07);fr.material=M.timber;
      const gl=BABYLON.MeshBuilder.CreateBox(name+'gl'+i,{width:.66,height:.76,depth:.1},scene);gl.parent=root;gl.position.set(px,2,-d/2-.12);gl.material=M.blue;
    });
    const ch=BABYLON.MeshBuilder.CreateBox(name+'ch',{width:.52,depth:.52,height:1.5},scene);ch.parent=root;ch.position.set(w*.18,hgt+2.25,d*.1);ch.material=M.stoneD;
    if(o.guild){const sg=BABYLON.MeshBuilder.CreateBox(name+'sg',{width:2.5,height:.9,depth:.18},scene);sg.parent=root;sg.position.set(0,2.9,-d/2-1.22);sg.material=M.wood;const st=BABYLON.MeshBuilder.CreatePolyhedron(name+'star',{type:2,size:.34},scene);st.parent=sg;st.position.z=-.16;st.material=M.gold;shadows.addShadowCaster(sg);shadows.addShadowCaster(st)}
    [f,b,roof,door,porch,ch,...posts].forEach(m=>shadows.addShadowCaster(m));
    return root;
  }
  building('guild',0,-15,{w:6.2,d:5.4,h:3.55,guild:true});
  building('west',-10.5,-5.5,{rot:.05});building('east',10.7,-3.8,{rot:-.08});
  building('nw',-11.8,-17.7,{w:4,d:3.6,h:2.45,rot:-.03});building('ne',11.6,-18.4,{w:4,d:3.6,h:2.45,rot:.07});
  building('sw',-8.5,13.5,{w:3.9,d:3.5,h:2.45,rot:.1});building('se',8.9,14.2,{w:3.9,d:3.5,h:2.45,rot:-.08});building('smithy',-2.8,10.1,{w:4.5,d:3.9,h:2.65,rot:-.04});

  function tree(x,z,v=0){
    const root=new BABYLON.TransformNode('tree',scene);root.position.set(x,h(x,z),z);root.rotation.y=Math.random()*Math.PI*2;
    const th=2.7+Math.random()*1.3;
    const t=BABYLON.MeshBuilder.CreateCylinder('trunk',{height:th,diameterTop:.25,diameterBottom:.48,tessellation:8},scene);t.parent=root;t.position.y=th/2;t.material=M.wood;t.checkCollisions=true;shadows.addShadowCaster(t);
    const foliage=[];
    if(v%3===0){for(let i=0;i<3;i++){const c=BABYLON.MeshBuilder.CreateCylinder('fol',{height:2.05-i*.2,diameterTop:0,diameterBottom:2.8-i*.35,tessellation:9},scene);c.parent=root;c.position.y=th+.7+i*.8;c.material=[M.leafA,M.leafB,M.leafC][i%3];foliage.push(c)}}
    else{const a=BABYLON.MeshBuilder.CreateSphere('fa',{diameter:2.7,segments:9},scene);a.parent=root;a.position.set(0,th+1.15,0);a.scaling.set(1.15,.9,1.05);a.material=M.leafB;foliage.push(a);const b=BABYLON.MeshBuilder.CreateSphere('fb',{diameter:2.0,segments:8},scene);b.parent=root;b.position.set(.7,th+1.85,.15);b.material=M.leafA;foliage.push(b);const c=BABYLON.MeshBuilder.CreateSphere('fc',{diameter:1.75,segments:8},scene);c.parent=root;c.position.set(-.75,th+1.7,.2);c.material=M.leafC;foliage.push(c)}
    foliage.forEach(m=>shadows.addShadowCaster(m));
  }
  for(let i=0;i<74;i++){const a=Math.random()*Math.PI*2,r=23+Math.random()*37,x=Math.cos(a)*r,z=Math.sin(a)*r;if(village(x,z)||onRoad(x,z))continue;tree(x,z,i)}

  const blade=BABYLON.MeshBuilder.CreatePlane('blade',{width:.14,height:.72},scene);blade.material=M.grass2;blade.position.y=.36;
  const b2=blade.clone('b2');b2.rotation.y=Math.PI/3;const b3=blade.clone('b3');b3.rotation.y=-Math.PI/3;
  const gm=BABYLON.Mesh.MergeMeshes([blade,b2,b3],true,true,undefined,false,true);gm.isVisible=false;
  const sway=[];
  for(let i=0;i<360;i++){const x=(Math.random()-.5)*118,z=(Math.random()-.5)*118;if(onRoad(x,z)||(village(x,z)&&Math.random()<.78))continue;const g=gm.createInstance('g'+i);g.position.set(x,h(x,z),z);const s=.65+Math.random()*1.3;g.scaling.set(s,.55+Math.random()*.75,s);g.rotation.y=Math.random()*Math.PI;sway.push({g,base:g.rotation.y,p:Math.random()*6.28,a:.04+Math.random()*.06})}

  function humanoid(name,bodyMat,x,z){
    const r=new BABYLON.TransformNode(name,scene);r.position.set(x,h(x,z),z);
    const torso=BABYLON.MeshBuilder.CreateCapsule(name+'torso',{height:1.55,radius:.39,tessellation:14},scene);torso.parent=r;torso.position.y=1.42;torso.scaling.z=.78;torso.material=bodyMat;
    const head=BABYLON.MeshBuilder.CreateSphere(name+'head',{diameter:.68,segments:14},scene);head.parent=r;head.position.y=2.31;head.material=M.skin;
    const hair=BABYLON.MeshBuilder.CreateSphere(name+'hair',{diameter:.75,segments:10,slice:.58},scene);hair.parent=r;hair.position.set(0,2.5,-.02);hair.rotation.x=Math.PI;hair.material=M.hair;
    [torso,head,hair].forEach(m=>shadows.addShadowCaster(m));return r;
  }

  const player = new BABYLON.TransformNode('PlayerRoot', scene);
  player.position.set(0, h(0, 15), 15);

  // Imported character stays under its original Armature hierarchy.
  // Only the Armature root is attached to PlayerRoot.
  let kotaReady = false;
  let currentAnim = '';
  let kotaArmature = null;
  const kotaAnims = {};
  const beginButton = $('begin');
  const modelStatus = $('model-status');

  beginButton.disabled = true;
  beginButton.textContent = 'Loading Kota…';
  modelStatus.classList.add('show');
  modelStatus.textContent = 'Loading Kota.glb…';

  async function loadKota() {
    try {
      const container = await BABYLON.SceneLoader.LoadAssetContainerAsync(
        './',
        'Kota.glb',
        scene,
        undefined,
        '.glb'
      );

      container.addAllToScene();

      kotaArmature = container.transformNodes.find(node => node.name === 'Armature')
        || container.meshes.find(node => node.name === 'Armature');

      if (!kotaArmature) {
        throw new Error('Armature node was not found inside Kota.glb');
      }

      // Preserve Meshy scale and complete skeleton hierarchy.
      kotaArmature.parent = player;
      kotaArmature.position.set(0, 0, 0);
      kotaArmature.rotationQuaternion = null;
      kotaArmature.rotation.set(0, Math.PI, 0);

      container.meshes.forEach(mesh => {
        if (mesh.getTotalVertices && mesh.getTotalVertices() > 0) {
          shadows.addShadowCaster(mesh);
          mesh.receiveShadows = true;
          mesh.alwaysSelectAsActiveMesh = true;
        }
      });

      container.animationGroups.forEach(group => {
        const key = (group.name || '').trim().toLowerCase();
        kotaAnims[key] = group;
        group.stop();
      });

      const required = ['idle', 'walk', 'run', 'punch'];
      const missing = required.filter(name => !kotaAnims[name]);
      if (missing.length) {
        throw new Error('Missing animation clips: ' + missing.join(', '));
      }

      kotaReady = true;
      playKotaAnimation('idle', true);
      beginButton.disabled = false;
      beginButton.textContent = 'Begin';
      modelStatus.textContent = 'Kota loaded';
      setTimeout(() => modelStatus.classList.remove('show'), 900);

      console.log('Kota loaded successfully', {
        meshes: container.meshes.length,
        transformNodes: container.transformNodes.length,
        animations: Object.keys(kotaAnims)
      });
    } catch (error) {
      console.error('Kota.glb failed to load', error);
      beginButton.disabled = true;
      beginButton.textContent = 'Kota failed to load';
      modelStatus.classList.add('show');
      modelStatus.textContent = 'Kota error: ' + (error?.message || String(error));
    }
  }

  function playKotaAnimation(name, loop = true, speed = 1) {
    if (!kotaReady) return;
    const key = name.toLowerCase();
    if (currentAnim === key && loop) return;
    Object.values(kotaAnims).forEach(group => group.stop());
    const group = kotaAnims[key];
    if (!group) return;
    group.start(loop, speed, group.from, group.to, false);
    currentAnim = key;
  }

  loadKota();
  const rowan=humanoid('Rowan',M.npc,0,-10.5);rowan.rotation.y=Math.PI;
  let gameStarted=false,dialogueOpen=false,punching=false,rolling=false,currentQuest='rowan',moveX=0,moveY=0;
  const input={keys:{}};addEventListener('keydown',e=>input.keys[e.key.toLowerCase()]=true);addEventListener('keyup',e=>input.keys[e.key.toLowerCase()]=false);

  const rowanLines=[["Guild Master Rowan","There you are. Late, which is impressive for your first day."],["Kota","You said you had work."],["Guild Master Rowan","A blue beacon flared near Bramble Cave. Take the eastern road and find out why."],["Guild Master Rowan","You are unarmed. Avoid trouble. If it refuses, your fists will have to negotiate."],["System","NEW ASSIGNMENT — Follow the eastern road to the Hollow Beacon."]];
  const beaconLines=[["Astraea","At last, the lost child reaches a place the world was meant to forget."],["Kota","Who are you?"],["Astraea","Astraea. Witness of time. The Demon Lord erases what he cannot conquer."],["Astraea","Take the first Star, and let broken things remember their true shape."],["System","STAR OF ECHOES AWAKENED."]];
  let active=[],di=0;
  function showLine(){$("speaker").textContent=active[di][0];$("line").textContent=active[di][1]}
  function beginDialog(lines){if(dialogueOpen)return;dialogueOpen=true;active=lines;di=0;$("dialogue").classList.add('show');showLine()}
  $("dialogue").addEventListener('pointerdown',()=>{di++;if(di>=active.length){dialogueOpen=false;$("dialogue").classList.remove('show');if(currentQuest==='rowan'){currentQuest='beacon';$("quest-text").textContent='Reach the Hollow Beacon';toast('Assignment accepted')}else if(currentQuest==='beacon'){currentQuest='return';$("quest-text").textContent='Return to Ashbrook';toast('Star System Unlocked')}return}showLine()});
  function toast(s){const t=$("toast");t.textContent=s;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1300)}
  function flash(id){const b=$(id);b.classList.add('active');setTimeout(()=>b.classList.remove('active'),120)}
  function punch(){
    if(punching||dialogueOpen||!kotaReady)return;
    punching=true;flash('attack');navigator.vibrate?.(16);
    playKotaAnimation('punch',false,1.12);
    const g=kotaAnims.punch;
    const duration=g&&g.to>g.from?Math.max(260,((g.to-g.from)/30)*1000/1.12):520;
    setTimeout(()=>{punching=false;playKotaAnimation('idle',true);},duration);
  }
  function roll(){if(rolling||dialogueOpen)return;rolling=true;flash('roll');setTimeout(()=>rolling=false,420)}
  $("attack").addEventListener('pointerdown',punch);$("roll").addEventListener('pointerdown',roll);

  const stick=$("stick"),knob=$("knob");let sid=null,ctr={x:0,y:0};
  function upd(e){const t=[...e.changedTouches].find(v=>v.identifier===sid);if(!t)return;const dx=t.clientX-ctr.x,dy=t.clientY-ctr.y,l=Math.hypot(dx,dy),mx=39,s=Math.min(1,mx/(l||1)),x=dx*s,y=dy*s;knob.style.transform=`translate(${x}px,${y}px)`;moveX=x/mx;moveY=y/mx}
  stick.addEventListener('touchstart',e=>{const r=stick.getBoundingClientRect();ctr={x:r.left+r.width/2,y:r.top+r.height/2};sid=e.changedTouches[0].identifier;upd(e)},{passive:false});stick.addEventListener('touchmove',e=>{e.preventDefault();upd(e)},{passive:false});function rel(){sid=null;moveX=moveY=0;knob.style.transform='translate(0,0)'}stick.addEventListener('touchend',rel);stick.addEventListener('touchcancel',rel);

  const beaconRoot=new BABYLON.TransformNode('Beacon',scene);beaconRoot.position.set(31,h(31,-8),-8);
  for(let i=0;i<6;i++){const p=BABYLON.MeshBuilder.CreateBox('pillar',{width:1.2,height:3.2+Math.random()*2.8,depth:1.2},scene);const a=i*Math.PI/3;p.parent=beaconRoot;p.position.set(Math.cos(a)*4.2,p.getBoundingInfo().boundingBox.extendSize.y,Math.sin(a)*4.2);p.material=i%2?M.stoneD:M.stone;p.receiveShadows=true;shadows.addShadowCaster(p)}
  const star=BABYLON.MeshBuilder.CreatePolyhedron('star',{type:2,size:1.15},scene);star.parent=beaconRoot;star.position.y=3.3;star.material=M.blue;
  const bl=new BABYLON.PointLight('bl',new BABYLON.Vector3(0,3.3,0),scene);bl.parent=beaconRoot;bl.diffuse=new BABYLON.Color3(.25,.7,1);bl.intensity=20;bl.range=20;
  const ps=new BABYLON.ParticleSystem('ps',400,scene);ps.particleTexture=new BABYLON.Texture('https://assets.babylonjs.com/textures/flare.png',scene);ps.emitter=star;ps.minEmitBox=new BABYLON.Vector3(-.15,-.15,-.15);ps.maxEmitBox=new BABYLON.Vector3(.15,.15,.15);ps.color1=new BABYLON.Color4(.2,.65,1,1);ps.color2=new BABYLON.Color4(.85,.95,1,.7);ps.minSize=.05;ps.maxSize=.18;ps.minLifeTime=.7;ps.maxLifeTime=2;ps.emitRate=90;ps.direction1=new BABYLON.Vector3(-.5,.6,-.5);ps.direction2=new BABYLON.Vector3(.5,1.4,.5);ps.start();

  function objective(){if(currentQuest==='rowan')return rowan.position;if(currentQuest==='beacon')return beaconRoot.position;return new BABYLON.Vector3(0,h(0,-15),-15)}
  $("begin").addEventListener('click',()=>{$("title-screen").style.display='none';gameStarted=true;toast('Welcome to Ashbrook');canvas.focus()});

  let lastA=false,lastB=false,padShown=false;
  scene.onBeforeRenderObservable.add(()=>{
    const t=performance.now()*.001,dt=Math.min(.033,engine.getDeltaTime()/1000);
    sun.direction=new BABYLON.Vector3(-.6+Math.sin(t*.04)*.05,-1,.28);
    star.rotation.y+=dt*.65;sway.forEach(s=>s.g.rotation.y=s.base+Math.sin(t*1.7+s.p)*s.a);
    const pad=navigator.getGamepads?[...navigator.getGamepads()].find(Boolean):null;
    if(pad){if(!padShown){$("controller-status").classList.add('show');padShown=true}if(Math.abs(pad.axes[0])>.15||Math.abs(pad.axes[1])>.15){moveX=pad.axes[0];moveY=pad.axes[1]}else if(!sid){moveX=moveY=0}if(Math.abs(pad.axes[2])>.18)camera.alpha+=pad.axes[2]*.045;if(Math.abs(pad.axes[3])>.18)camera.beta=BABYLON.Scalar.Clamp(camera.beta+pad.axes[3]*.028,camera.lowerBetaLimit,camera.upperBetaLimit);const a=pad.buttons[0]?.pressed,b=pad.buttons[1]?.pressed;if(a&&!lastA)punch();if(b&&!lastB)roll();lastA=a;lastB=b}
    if(!gameStarted||dialogueOpen)return;
    let x=moveX+(input.keys.d?1:0)-(input.keys.a?1:0),y=moveY+(input.keys.s?1:0)-(input.keys.w?1:0),l=Math.hypot(x,y);if(l>1){x/=l;y/=l}
    if(l>.08){const f=camera.getForwardRay().direction;f.y=0;f.normalize();const r=BABYLON.Vector3.Cross(BABYLON.Axis.Y,f).normalize();const d=r.scale(x).add(f.scale(-y)).normalize(),sp=rolling?8.8:4.6;player.position.addInPlace(d.scale(sp*dt));player.rotation.y=Math.atan2(d.x,d.z);player.position.y=h(player.position.x,player.position.z)}
    if(kotaReady&&!punching){if(l>.72)playKotaAnimation('run',true,1.05);else if(l>.08)playKotaAnimation('walk',true,1);else playKotaAnimation('idle',true,1);}
    player.position.x=BABYLON.Scalar.Clamp(player.position.x,-58,58);player.position.z=BABYLON.Scalar.Clamp(player.position.z,-58,58);camera.target=BABYLON.Vector3.Lerp(camera.target,player.position.add(new BABYLON.Vector3(0,1.35,0)),.12);
    const target=objective(),d=target.subtract(player.position),dist=Math.round(Math.hypot(d.x,d.z));$("objective-distance").textContent=dist+' m';document.querySelector('#objective-marker .arrow').style.transform=`rotate(${Math.atan2(d.x,d.z)-camera.alpha-Math.PI/2}rad)`;
    const rd=BABYLON.Vector3.Distance(player.position,rowan.position),bd=BABYLON.Vector3.Distance(player.position,beaconRoot.position),nr=currentQuest==='rowan'&&rd<3.2,nb=currentQuest==='beacon'&&bd<4;const p=$("interaction-prompt");p.textContent=nr?'Talk to Rowan':nb?'Touch the Beacon':'';p.classList.toggle('show',nr||nb);if(nr&&rd<2.1)beginDialog(rowanLines);if(nb&&bd<2.8)beginDialog(beaconLines)
  });

  engine.runRenderLoop(()=>scene.render());addEventListener('resize',()=>engine.resize());
})();
