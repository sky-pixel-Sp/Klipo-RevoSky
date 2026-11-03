"use strict";

const CAPTION_PRESETS = [
  { id: "classic", name: "Classic White", fontColor: "white", fontSize: 58, borderColor: "black", borderWidth: 3, box: false, y: "h*0.78" },
  { id: "bold-outline", name: "Bold Outline", fontColor: "white", fontSize: 66, borderColor: "black", borderWidth: 5, box: false, y: "h*0.76" },
  { id: "yellow-pop", name: "Yellow Pop", fontColor: "yellow", fontSize: 64, borderColor: "black", borderWidth: 4, box: false, y: "h*0.76" },
  { id: "cyan-pop", name: "Cyan Pop", fontColor: "cyan", fontSize: 62, borderColor: "black", borderWidth: 4, box: false, y: "h*0.76" },
  { id: "red-alert", name: "Red Alert", fontColor: "red", fontSize: 62, borderColor: "white", borderWidth: 3, box: true, boxColor: "black@0.45", y: "h*0.75" },
  { id: "minimal", name: "Minimal Clean", fontColor: "white", fontSize: 48, borderColor: "black", borderWidth: 2, box: false, y: "h*0.82" },
  { id: "soft-shadow", name: "Soft Shadow", fontColor: "white", fontSize: 56, borderColor: "black", borderWidth: 1, shadow: 3, box: false, y: "h*0.78" },
  { id: "creator-bold", name: "Creator Bold", fontColor: "white", fontSize: 70, borderColor: "black", borderWidth: 5, box: false, y: "h*0.73" },
  { id: "gold-cinema", name: "Cinema Gold", fontColor: "gold", fontSize: 52, borderColor: "black", borderWidth: 2, box: false, y: "h*0.83" },
  { id: "pink-highlight", name: "Pink Highlight", fontColor: "pink", fontSize: 60, borderColor: "black", borderWidth: 3, box: true, boxColor: "black@0.35", y: "h*0.77" },
  { id: "green-marker", name: "Green Marker", fontColor: "lime", fontSize: 60, borderColor: "black", borderWidth: 4, box: false, y: "h*0.76" },
  { id: "documentary", name: "Documentary", fontColor: "white", fontSize: 46, borderColor: "black", borderWidth: 2, box: true, boxColor: "black@0.55", y: "h*0.84" },
  { id: "blue-karaoke", name: "Blue Karaoke", fontColor: "deepskyblue", fontSize: 62, borderColor: "white", borderWidth: 2, box: false, y: "h*0.75" },
  { id: "news-bar", name: "News Bar", fontColor: "white", fontSize: 48, borderColor: "black", borderWidth: 1, box: true, boxColor: "darkred@0.88", y: "h*0.86" },
  { id: "comic", name: "Comic Impact", fontColor: "yellow", fontSize: 72, borderColor: "black", borderWidth: 6, box: false, y: "h*0.72" },
  { id: "pastel", name: "Pastel Soft", fontColor: "white", fontSize: 54, borderColor: "black", borderWidth: 2, box: true, boxColor: "0x9B83C4@0.78", y: "h*0.80" },
  { id: "mono", name: "Mono Terminal", fontColor: "white", fontSize: 46, borderColor: "black", borderWidth: 1, box: true, boxColor: "0x20242B@0.85", y: "h*0.84" },
  { id: "elegant", name: "Elegant Serif", fontColor: "white", fontSize: 52, borderColor: "black", borderWidth: 2, box: false, y: "h*0.82" },
  { id: "sports", name: "Sports Energy", fontColor: "yellow", fontSize: 68, borderColor: "black", borderWidth: 6, box: false, y: "h*0.74" },
  { id: "high-contrast", name: "High Contrast", fontColor: "white", fontSize: 64, borderColor: "black", borderWidth: 7, box: false, y: "h*0.76" },
  { id: "vintage", name: "Vintage Cream", fontColor: "0xF4E6C8", fontSize: 50, borderColor: "0x382B20", borderWidth: 2, box: false, y: "h*0.82" },
  { id: "lavender", name: "Lavender Glow", fontColor: "0xE6D6FF", fontSize: 60, borderColor: "0x382A52", borderWidth: 3, shadow: 2, box: false, y: "h*0.77" },
  { id: "orange", name: "Orange Punch", fontColor: "0xFF9F43", fontSize: 64, borderColor: "black", borderWidth: 4, box: false, y: "h*0.76" },
  { id: "lower-third", name: "Lower Third", fontColor: "white", fontSize: 42, borderColor: "black", borderWidth: 1, box: true, boxColor: "0x18232E@0.88", y: "h*0.88" },
  { id: "compact", name: "Compact Subtitle", fontColor: "white", fontSize: 40, borderColor: "black", borderWidth: 2, box: true, boxColor: "black@0.38", y: "h*0.86" }
];

function getCaptionPreset(id) {
  return CAPTION_PRESETS.find((preset) => preset.id === id) || CAPTION_PRESETS[0];
}

if (typeof module !== "undefined") module.exports = { CAPTION_PRESETS, getCaptionPreset };