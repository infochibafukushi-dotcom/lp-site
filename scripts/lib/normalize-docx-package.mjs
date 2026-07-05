import JSZip from "jszip";

const EMPTY_RELS = new Set([
  "word/_rels/comments.xml.rels",
  "word/_rels/footnotes.xml.rels",
  "word/_rels/endnotes.xml.rels",
  "word/_rels/fontTable.xml.rels"
]);

function isEmptyRelationshipsXml(xml){
  return !/<Relationship\s/i.test(String(xml || ""));
}

export async function normalizeDocxBuffer(buffer){
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files);

  for(const name of names){
    if(!EMPTY_RELS.has(name)){
      continue;
    }
    const entry = zip.file(name);
    if(!entry){
      continue;
    }
    const xml = await entry.async("string");
    if(isEmptyRelationshipsXml(xml)){
      zip.remove(name);
    }
  }

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });
}
