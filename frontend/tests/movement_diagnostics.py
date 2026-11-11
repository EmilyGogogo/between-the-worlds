"""Read-only-to-assets render A/B experiment, using real CDP keyboard input."""
import json


def diagnose(c):
    # Use the normal click/start path with pointer lock deliberately denied, so a
    # headless pointer-lock wait cannot prevent measurement of keyboard movement.
    c.evaluate("document.getElementById('world').requestPointerLock=()=>Promise.reject(new DOMException('Diagnostic denial','NotAllowedError'));true")
    point = c.evaluate("(()=>{const r=document.getElementById('enter').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()")
    for kind in ('mousePressed', 'mouseReleased'):
        c.call('Input.dispatchMouseEvent', {'type': kind, **point, 'button': 'left', 'clickCount': 1})
    c.wait_for('window.__world.started', 10)
    c.evaluate(r"""(()=>{
      const g=window.__world;
      g.pause();g.finishTransition();g.clearInput();
      g.__ab={entities:g.world.serialize(),time:g.world.time,yaw:g.yaw,pitch:g.pitch,
        meshes:[],move:g.move,moveCalls:0};
      for(const e of g.world.entities)if(e.kind==='blueMorpho')e.visual.traverse(o=>{
        if(o.isMesh)g.__ab.meshes.push({mesh:o,visible:o.visible});
      });
      g.move=function(dt){this.__ab.moveCalls++;return this.__ab.move.call(this,dt);};
      return true;
    })()""")
    try:
        for label, hidden in (('enabled', False), ('hidden', True), ('restored', False)):
            c.evaluate(r"""(()=>{
              const g=window.__world,a=g.__ab;
              g.pause();g.world.restore(a.entities);g.world.time=a.time;
              g.yaw=a.yaw;g.pitch=a.pitch;g.player.heading=g.yaw;g.player.root.rotation.y=g.yaw;
              g.collision.refresh();g.snapCamera=true;g.updateCamera(0);
              for(const {mesh,visible} of a.meshes)mesh.visible=HIDDEN?false:visible;
              g.resume(false);g.clock.getDelta();a.moveCalls=0;
              a.before={wall:performance.now(),elapsed:g.elapsed,frame:g.renderer.info.render.frame,
                position:g.world.position(g.player).toArray(),entities:g.world.entities.length,
                colliders:g.collision.records.length};
              return true;
            })()""".replace('HIDDEN', 'true' if hidden else 'false'))
            c.call('Input.dispatchKeyEvent', {'type': 'keyDown', 'code': 'KeyW', 'key': 'w', 'windowsVirtualKeyCode': 87})
            result = c.evaluate(r"""new Promise(resolve=>setTimeout(()=>{
              const g=window.__world,a=g.__ab,p=g.world.position(g.player),b=a.before;
              const after={wall:performance.now(),elapsed:g.elapsed,frame:g.renderer.info.render.frame,
                position:p.toArray(),entities:g.world.entities.length,colliders:g.collision.records.length};
              const result={before:b,after,wallSeconds:(after.wall-b.wall)/1000,
                elapsedDelta:after.elapsed-b.elapsed,renderFrameDelta:after.frame-b.frame,
                moveCalls:a.moveCalls,distance:p.distanceTo(p.clone().fromArray(b.position)),
                paused:g.paused,actions:[...g.actions],transition:g.transition?.opening?'opening':g.transition?'possession':null,
                render:{...g.renderer.info.render},movementRatio:g.player.movementRatio};
              g.pause();resolve(result);
            },5000))""")
            print('MOVEMENT_DIAGNOSTIC ' + json.dumps({'render': label, **result}), flush=True)
            c.call('Input.dispatchKeyEvent', {'type': 'keyUp', 'code': 'KeyW', 'key': 'w', 'windowsVirtualKeyCode': 87})
    finally:
        c.evaluate(r"""(()=>{
          const g=window.__world,a=g.__ab;g.pause();g.move=a.move;
          for(const {mesh,visible} of a.meshes)mesh.visible=visible;
          g.world.restore(a.entities);g.world.time=a.time;g.clearInput();delete g.__ab;return true;
        })()""")
    print('DIAGNOSTIC ONLY: no regression or target-device FPS acceptance claimed.', flush=True)
