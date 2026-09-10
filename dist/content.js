/* Append a stage/track/flag record to extend the catalog without changing match rules. */
(function (root) {
  'use strict';
  const STAGES = [
    {id:'beach',name:'파도 해변',tag:'BEACH',sky:'#9fd9e8',haze:'#edf4d7',ground:'#e0c896',sand:[230,197,135],track:'tideline',water:'#73bec6'},
    {id:'playground',name:'동네 놀이터',tag:'PLAYGROUND',sky:'#b0dfed',haze:'#eaf3d5',ground:'#a3bb80',sand:[222,189,131],track:'hopscotch'},
    {id:'ssireum',name:'씨름 대회장',tag:'SSIREUM ARENA',sky:'#cbddee',haze:'#f8e7c8',ground:'#b39d79',sand:[223,195,146],track:'jangdan'},
    {id:'ocean-ship',name:'바다 위 모래 운반선',tag:'OCEAN SHIP',sky:'#95c8e8',haze:'#d5e9e7',ground:'#4a9bb6',sand:[219,187,132],track:'blue-voyage',water:'#4c9cb7',motion:1},
    {id:'river-boat',name:'강 위 나룻배',tag:'RIVER BOAT',sky:'#c0dfd7',haze:'#ecedcf',ground:'#73a6a0',sand:[208,186,141],track:'reed-song',water:'#72a59a',motion:.45},
    {id:'desert',name:'사막 오아시스',tag:'DESERT',sky:'#e8c6a1',haze:'#f8dfb4',ground:'#dcb279',sand:[230,177,112],track:'dune-walk'},
    {id:'garden',name:'보타닉 가든',tag:'BOTANIC GARDEN',sky:'#b8dfd4',haze:'#eaf2cf',ground:'#839f74',sand:[183,153,105],track:'glass-leaves'},
    {id:'school',name:'학교 운동장',tag:'SCHOOLYARD',sky:'#a9d9ed',haze:'#eef1d1',ground:'#ba9671',sand:[215,181,127],track:'after-school'},
    {id:'village',name:'시골 마당',tag:'COUNTRY YARD',sky:'#e1d4b5',haze:'#f5ead0',ground:'#aa946e',sand:[199,166,112],track:'porch-light'},
    {id:'quarry',name:'채석장 공터',tag:'QUARRY',sky:'#bdcbd0',haze:'#e5ded0',ground:'#a8a69c',sand:[182,170,139],track:'stone-step'},
    {id:'forest',name:'숲속 캠핑장',tag:'FOREST CAMP',sky:'#94b6b0',haze:'#d8ddba',ground:'#768d65',sand:[190,157,105],track:'pine-lullaby'},
    {id:'ruins',name:'고대 유적 발굴장',tag:'ANCIENT RUINS',sky:'#b6c9d7',haze:'#e8debd',ground:'#b5a785',sand:[217,186,135],track:'buried-stars'}
  ];
  // Original step sequences, pitches in semitones above the root; null means rest.
  const TRACKS = [
    {id:'tideline',name:'모래 위 작은 파도',bpm:96,root:60,voice:'triangle',bass:[0,5,7,5],notes:[0,4,7,12,9,7,4,null,2,5,9,14,12,9,5,null,4,7,11,16,14,11,7,4,2,4,7,9,7,4,2,0]},
    {id:'hopscotch',name:'한 칸 두 칸',bpm:124,root:65,voice:'sine',bass:[0,7,5,0],notes:[0,0,7,null,4,4,9,7,5,null,5,9,7,4,2,null,0,4,7,4,12,12,9,7,5,9,5,2,7,4,2,0]},
    {id:'jangdan',name:'모래판 장단',bpm:112,root:57,voice:'triangle',bass:[0,0,7,5],notes:[0,null,3,5,7,null,10,7,5,3,null,0,5,null,7,10,12,10,7,null,5,7,5,3,0,null,3,5,7,5,3,0],drum:1.7},
    {id:'blue-voyage',name:'푸른 항해',bpm:100,root:62,voice:'square',bass:[0,5,7,0],notes:[0,7,12,7,9,12,14,null,12,9,7,4,5,9,7,null,4,7,12,16,14,12,9,7,5,4,2,7,4,2,0,null]},
    {id:'reed-song',name:'갈대 사이로',bpm:78,root:62,voice:'sine',bass:[0,5,2,7],notes:[0,null,2,7,5,null,2,0,2,5,9,null,7,5,2,null,7,9,12,null,9,7,5,2,0,2,5,null,2,null,0,null]},
    {id:'dune-walk',name:'모래 언덕의 발자국',bpm:90,root:57,voice:'triangle',bass:[0,1,5,0],notes:[0,1,4,7,8,null,7,4,1,0,1,4,5,4,1,null,7,8,12,8,7,4,5,7,4,1,0,null,1,4,1,0]},
    {id:'glass-leaves',name:'유리 온실의 잎사귀',bpm:84,root:67,voice:'sine',bass:[0,4,5,2],notes:[0,4,9,null,7,4,2,null,5,9,12,null,9,7,5,4,2,7,11,null,9,7,4,2,0,4,7,9,7,null,4,0]},
    {id:'after-school',name:'수업이 끝나면',bpm:118,root:60,voice:'triangle',bass:[0,7,5,7],notes:[7,7,4,0,2,2,5,null,4,4,7,12,9,7,5,null,7,12,14,12,9,7,4,0,5,9,7,5,4,2,0,null]},
    {id:'porch-light',name:'평상 위 늦은 오후',bpm:76,root:60,voice:'triangle',bass:[0,5,0,7],notes:[0,null,2,4,7,null,4,2,0,2,4,null,9,7,4,null,5,9,7,5,4,null,2,0,2,4,7,null,4,2,0,null]},
    {id:'stone-step',name:'돌과 톱니',bpm:108,root:48,voice:'square',bass:[0,3,5,7],notes:[0,7,0,3,null,7,3,0,5,12,5,7,null,10,7,5,3,10,3,5,7,null,5,3,0,3,7,10,7,3,0,null],drum:1.4},
    {id:'pine-lullaby',name:'솔잎의 자장가',bpm:72,root:64,voice:'sine',bass:[0,5,9,7],notes:[0,3,7,null,10,7,3,null,5,8,12,null,10,8,5,null,7,10,14,12,10,7,3,null,5,3,2,null,3,2,0,null]},
    {id:'buried-stars',name:'잠든 별의 유적',bpm:82,root:55,voice:'triangle',bass:[0,5,8,7],notes:[0,7,12,null,10,7,3,null,5,12,17,15,12,8,5,null,8,15,19,null,17,15,12,8,7,10,14,10,7,3,0,null]}
  ];
  const FLAGS = [
    {id:'strawhat',name:'밀짚모자 해적단',background:'#151b24',accent:'#ebc25c'},
    {id:'heart',name:'하트 해적단',background:'#f3d04d',accent:'#171b23'},
    {id:'redhair',name:'빨간 머리 해적단',background:'#18222b',accent:'#ba3445'},
    {id:'whitebeard',name:'흰수염 해적단',background:'#312944',accent:'#f4eddb'},
    {id:'blackbeard',name:'검은수염 해적단',background:'#171b24',accent:'#f3ead2'},
    {id:'roger',name:'로저 해적단',background:'#222028',accent:'#efc261'},
    {id:'buggy',name:'버기 해적단',background:'#1d2945',accent:'#d94848'},
    {id:'sun',name:'태양 해적단',background:'#efe5cd',accent:'#cf433b'}
  ];
  const MATERIALS = [
    {id:'twig',name:'나뭇가지',color:'#795239',density:.55,grip:1.2},
    {id:'chopstick',name:'나무젓가락',color:'#ca9c60',density:.7,grip:1},
    {id:'steel',name:'쇠젓가락',color:'#adb9c5',density:2.2,grip:.82},
    {id:'cue',name:'당구 큐대',color:'#bc8253',density:1.15,grip:1.08},
    {id:'bamboo',name:'대나무 막대',color:'#abb174',density:.6,grip:1.15},
    {id:'plastic',name:'플라스틱 막대',color:'#df7860',density:.5,grip:.85}
  ];
  const api={STAGES,TRACKS,FLAGS,MATERIALS};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.SandContent=api;
})(typeof globalThis!=='undefined'?globalThis:this);
