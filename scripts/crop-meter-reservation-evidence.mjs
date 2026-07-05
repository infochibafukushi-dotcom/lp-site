import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourcePath = path.join(
  rootDir,
  "screenshots/pre-fixed-fare-approval-20260705/03b_fixed_fare_meter_202607050600.png"
);
const outputPath = path.join(
  rootDir,
  "assets/evidence/pre-fixed-fare-20260705/05_meter_reservation_detail_202607050600.png"
);

function cropWithPowerShell(){
  const ps = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.Drawing",
    "$src = '" + sourcePath.replace(/'/g, "''") + "'",
    "$dst = '" + outputPath.replace(/'/g, "''") + "'",
    "$img = [System.Drawing.Image]::FromFile($src)",
    "$cropH = [int][Math]::Min($img.Height, [Math]::Round($img.Height * 0.58))",
    "$bmp = New-Object System.Drawing.Bitmap($img.Width, $cropH)",
    "$g = [System.Drawing.Graphics]::FromImage($bmp)",
    "$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic",
    "$g.DrawImage($img, 0, 0, (New-Object System.Drawing.Rectangle 0,0,$img.Width,$cropH), [System.Drawing.GraphicsUnit]::Pixel)",
    "New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null",
    "$bmp.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)",
    "$g.Dispose(); $bmp.Dispose(); $img.Dispose()",
    "Write-Output ('OK ' + $dst)"
  ].join("; ");
  const result = spawnSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8" });
  if(result.status !== 0){
    throw new Error("PowerShell crop failed: " + (result.stderr || result.stdout));
  }
  return result.stdout.trim();
}

function main(){
  if(!fs.existsSync(sourcePath)){
    throw new Error("ソース画像がありません: " + sourcePath);
  }
  const message = cropWithPowerShell();
  console.log(message, fs.statSync(outputPath).size, "bytes");
}

main();
