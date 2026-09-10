/* A shared per-pixel depth buffer prevents painter-order errors between intersecting objects. */
(function(root){'use strict';
function color(value){
 if(value.startsWith('#')){const n=parseInt(value.slice(1,7),16);return[n>>16,(n>>8)&255,n&255,255];}
 const a=value.match(/[\d.]+/g).map(Number);return[a[0],a[1],a[2],255];
}
class Raster {
 constructor(){this.canvas=document.createElement('canvas');this.ctx=this.canvas.getContext('2d');}
 resize(w,h){const k=Math.min(1,800/w,650/h);this.k=k;this.w=Math.max(1,Math.round(w*k));this.h=Math.max(1,Math.round(h*k));this.canvas.width=this.w;this.canvas.height=this.h;this.pixels=this.ctx.createImageData(this.w,this.h);this.depth=new Float32Array(this.w*this.h);this.clear();}
 clear(){this.pixels.data.fill(0);this.depth.fill(-Infinity);}
 triangle(a,b,c,fill,texture){
  const k=this.k,ax=a.x*k,ay=a.y*k,bx=b.x*k,by=b.y*k,cx=c.x*k,cy=c.y*k;
  const area=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);if(Math.abs(area)<.000001)return;
  const left=Math.max(0,Math.floor(Math.min(ax,bx,cx))),right=Math.min(this.w-1,Math.ceil(Math.max(ax,bx,cx))),top=Math.max(0,Math.floor(Math.min(ay,by,cy))),bottom=Math.min(this.h-1,Math.ceil(Math.max(ay,by,cy))),rgba=color(fill),pixels=this.pixels.data;
  for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
   const u=((by-cy)*(x+.5-cx)+(cx-bx)*(y+.5-cy))/area,v=((cy-ay)*(x+.5-cx)+(ax-cx)*(y+.5-cy))/area,w=1-u-v;if(u<-.00001||v<-.00001||w<-.00001)continue;
   const d=u*a.d+v*b.d+w*c.d,i=x+y*this.w;if(d<this.depth[i]-.00001)continue;
   let red=rgba[0],green=rgba[1],blue=rgba[2];if(texture){const tx=Math.max(0,Math.min(texture.width-1,Math.floor((u*a.u+v*b.u+w*c.u)*texture.width))),ty=Math.max(0,Math.min(texture.height-1,Math.floor((u*a.v+v*b.v+w*c.v)*texture.height))),j=(tx+ty*texture.width)*4;if(texture.data[j+3]<128)continue;const shade=texture.shade??1;red=texture.data[j]*shade;green=texture.data[j+1]*shade;blue=texture.data[j+2]*shade;}
   this.depth[i]=d;const j=i*4;pixels[j]=red;pixels[j+1]=green;pixels[j+2]=blue;pixels[j+3]=255;
  }
 }
 polygon(poly,fill,texture){for(let i=1;i<poly.length-1;i++)this.triangle(poly[0],poly[i],poly[i+1],fill,texture);}
 cache(){this.staticPixels=this.pixels.data.slice();this.staticDepth=this.depth.slice();}
 restore(){this.pixels.data.set(this.staticPixels);this.depth.set(this.staticDepth);}
 present(ctx,w,h){this.ctx.putImageData(this.pixels,0,0);ctx.drawImage(this.canvas,0,0,w,h);}
}
if(typeof module!=='undefined'&&module.exports)module.exports=Raster;else root.SandRaster=Raster;
})(globalThis);
