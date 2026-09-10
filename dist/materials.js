/* Coefficients are gameplay approximations, not geotechnical measurements. */
(function(root){'use strict';
const sediments=[
 {id:'sand',name:'마른 모래',color:[216,184,127],density:1,cohesion:2,friction:2,erosion:.55,wetGain:1.7},
 {id:'fine-sand',name:'고운 모래',color:[231,207,157],density:.95,cohesion:1,friction:2,erosion:.9,wetGain:2},
 {id:'wet-sand',name:'젖은 모래',color:[163,140,100],density:1.2,cohesion:3,friction:3,erosion:.2,wetGain:.5},
 {id:'gravel',name:'자갈',color:[149,151,146],density:1.45,cohesion:0,friction:2,erosion:.04,wetGain:0},
 {id:'silt',name:'고운 흙',color:[185,153,116],density:1.05,cohesion:2,friction:2,erosion:.75,wetGain:.8},
 {id:'loam',name:'양토',color:[144,111,77],density:1.15,cohesion:3,friction:3,erosion:.35,wetGain:.6},
 {id:'clay',name:'점토',color:[179,123,93],density:1.3,cohesion:4,friction:4,erosion:.12,wetGain:.7},
 {id:'wet-clay',name:'젖은 점토',color:[122,98,83],density:1.4,cohesion:4,friction:3,erosion:.08,wetGain:.2}
];
if(typeof module!=='undefined'&&module.exports)module.exports=sediments;else root.SandSediments=sediments;
})(globalThis);
