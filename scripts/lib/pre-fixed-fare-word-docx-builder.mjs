import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { normalizeDocxBuffer } from "./normalize-docx-package.mjs";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from "docx";

const FONT = "Yu Gothic";
const MARGIN_MM = 15;
const MARGIN_TWIPS = Math.round(MARGIN_MM * 56.6929);

const FONT_BODY = 21;
const FONT_TABLE = 19;
const FONT_NOTE = 17;
const FONT_H3 = 25;
const FONT_H2 = 30;
const FONT_H1 = 36;
const FONT_APP_TITLE = 30;

const TABLE_BORDER = {
  style: BorderStyle.SINGLE,
  size: 1,
  color: "999999"
};

const CELL_MARGINS = {
  top: 40,
  bottom: 40,
  left: 60,
  right: 60
};

function textRun(text, options){
  options = options || {};
  return new TextRun({
    text: String(text ?? ""),
    font: FONT,
    size: options.size || FONT_BODY,
    bold: Boolean(options.bold),
    italics: Boolean(options.italics)
  });
}

function paragraph(text, options){
  options = options || {};
  const children = Array.isArray(text)
    ? text
    : [textRun(text, options)];
  return new Paragraph({
    children: children,
    alignment: options.alignment,
    spacing: { after: options.after ?? 120, before: options.before ?? 0 },
    pageBreakBefore: Boolean(options.pageBreakBefore)
  });
}

function heading(text, level){
  const map = {
    1: { size: FONT_H1, heading: HeadingLevel.HEADING_1 },
    2: { size: FONT_H2, heading: HeadingLevel.HEADING_2 },
    3: { size: FONT_H3, heading: HeadingLevel.HEADING_3 }
  };
  const spec = map[level] || map[3];
  return new Paragraph({
    heading: spec.heading,
    alignment: level === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { after: 160, before: level === 1 ? 240 : 200 },
    children: [textRun(text, { size: spec.size, bold: true })]
  });
}

function pageBreakParagraph(){
  return new Paragraph({ children: [new PageBreak()] });
}

function bulletList(items){
  return (items || []).map(function(item){
    return new Paragraph({
      bullet: { level: 0 },
      spacing: { after: 60 },
      children: [textRun(item)]
    });
  });
}

function tableCell(content, options){
  options = options || {};
  let children;
  if(content instanceof Paragraph){
    children = [content];
  }else if(Array.isArray(content)){
    children = content;
  }else{
    children = [paragraph(String(content ?? ""), Object.assign({ after: 40 }, options.paragraph || {}))];
  }
  return new TableCell({
    children: children,
    width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
    verticalAlign: options.verticalAlign || "center",
    margins: CELL_MARGINS
  });
}

function buildTable(headers, rows, options){
  options = options || {};
  const colWidths = options.colWidths || headers.map(function(){
    return Math.floor(100 / headers.length);
  });
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map(function(header, index){
      return tableCell(header, {
        width: colWidths[index],
        verticalAlign: "center",
        paragraph: { bold: true, alignment: AlignmentType.CENTER, after: 40, size: FONT_TABLE }
      });
    })
  });
  const bodyRows = (rows || []).map(function(row){
    return new TableRow({
      children: row.map(function(cell, index){
        const isAmountCol = options.amountCols && options.amountCols.includes(index);
        const isLabelCol = options.labelCols && options.labelCols.includes(index);
        const alignment = isAmountCol
          ? AlignmentType.CENTER
          : (isLabelCol ? AlignmentType.CENTER : AlignmentType.LEFT);
        return tableCell(cell, {
          width: colWidths[index],
          verticalAlign: isLabelCol ? "center" : "top",
          paragraph: { alignment: alignment, after: 40, size: FONT_TABLE }
        });
      })
    });
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow].concat(bodyRows)
  });
}

function kvTable(rows){
  return buildTable(
    ["項目", "内容"],
    rows || [],
    { colWidths: [28, 72], labelCols: [0] }
  );
}

function getPngDimensions(buffer){
  if(!buffer || buffer.length < 24 || buffer[0] !== 0x89){
    return { width: 800, height: 600 };
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function scaleImageDimensions(width, height, maxWidth){
  maxWidth = maxWidth || 520;
  if(width <= maxWidth){
    return { width: width, height: height };
  }
  const ratio = maxWidth / width;
  return {
    width: Math.round(maxWidth),
    height: Math.round(height * ratio)
  };
}

function imageParagraph(buffer, options){
  options = options || {};
  const dims = getPngDimensions(buffer);
  const scaled = scaleImageDimensions(dims.width, dims.height, options.maxWidth || 520);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 120, before: 80 },
    children: [
      new ImageRun({
        data: buffer,
        type: "png",
        transformation: scaled
      })
    ]
  });
}

function decodeText(value){
  return cheerio.load("<span>" + value + "</span>")("span").text().replace(/\s+/g, " ").trim();
}

function elementChildren($, element){
  const children = [];
  const tag = element.tagName ? element.tagName.toLowerCase() : "";
  const className = ($(element).attr("class") || "").toLowerCase();

  if(tag === "h1"){
    children.push(heading(decodeText($(element).html()), 1));
    return children;
  }
  if(tag === "h2"){
    children.push(heading(decodeText($(element).html()), 2));
    return children;
  }
  if(tag === "h3" || tag === "h4"){
    children.push(heading(decodeText($(element).html()), 3));
    return children;
  }
  if(tag === "p"){
    const text = decodeText($(element).html());
    if(text){
      const alignment = className.includes("date-line") ? AlignmentType.RIGHT : undefined;
      children.push(paragraph(text, { alignment: alignment }));
    }
    return children;
  }
  if(tag === "ul" || tag === "ol"){
    $(element).children("li").each(function(_, li){
      children.push(new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 60 },
        children: [textRun(decodeText($(li).html()))]
      }));
    });
    return children;
  }
  if(tag === "table"){
    const headers = [];
    $(element).find("thead th").each(function(_, th){
      headers.push(decodeText($(th).html()));
    });
    const rows = [];
    $(element).find("tbody tr").each(function(_, tr){
      const row = [];
      $(tr).children("td,th").each(function(_, td){
        row.push(decodeText($(td).html()));
      });
      if(row.length){
        rows.push(row);
      }
    });
    if(headers.length && rows.length){
      const amountCols = headers.map(function(h, i){
        return /金額|係数|単位/.test(h) ? i : -1;
      }).filter(function(i){ return i >= 0; });
      const labelCols = headers[0] === "項目" || headers[0] === "区分" ? [0] : [];
      children.push(buildTable(headers, rows, {
        colWidths: headers.length === 2 ? [28, 72] : undefined,
        amountCols: amountCols,
        labelCols: labelCols
      }));
      children.push(paragraph("", { after: 80 }));
    }
    return children;
  }

  if(tag === "section" || tag === "div" || tag === "main" || tag === "article"){
    if(className.includes("chapter-start") || className.includes("page-break-before") || className.includes("word-page-break")){
      children.push(pageBreakParagraph());
    }
    $(element).contents().each(function(_, child){
      if(child.type === "text"){
        const text = String(child.data || "").replace(/\s+/g, " ").trim();
        if(text){
          children.push(paragraph(text));
        }
        return;
      }
      if(child.type === "tag"){
        children.push.apply(children, elementChildren($, child));
      }
    });
    return children;
  }

  const fallback = decodeText($(element).html());
  if(fallback){
    children.push(paragraph(fallback));
  }
  return children;
}

function htmlToDocxChildren(html){
  if(!String(html || "").trim()){
    return [];
  }
  const $ = cheerio.load("<root>" + html + "</root>", { decodeEntities: false });
  const children = [];
  $("root").children().each(function(_, element){
    children.push.apply(children, elementChildren($, element));
  });
  return children;
}

function buildApplicationChildren(formData){
  const data = formData || {};
  const reiwa = data.reiwaDisplay || "令和　　年　　月　　日";
  return [
    paragraph(reiwa, { alignment: AlignmentType.RIGHT }),
    paragraph("関東運輸局長　殿"),
    paragraph(data.applicantAddress || ""),
    paragraph(data.applicantName || ""),
    paragraph(data.representativeName || ""),
    paragraph(data.contact || ""),
    heading("一般乗用旅客自動車運送事業の運賃及び料金（事前確定運賃）設定認可申請書", 1),
    paragraph("この度、一般乗用旅客自動車運送事業の運賃及び料金を、下記のとおり設定したいので、道路運送法第9条の3及び同法施行規則第10条の3の規定により申請いたします。"),
    paragraph("記", { alignment: AlignmentType.CENTER, bold: true, size: 24 }),
    heading("1. 申請者の氏名又は名称及び住所並びに法人にあっては、その代表者の氏名", 3),
    paragraph("住所：" + (data.applicantAddress || "")),
    paragraph("氏名又は名称：" + (data.applicantName || "")),
    paragraph([
      textRun("代表者氏名：" + (data.representativeName || "")),
      textRun("\t"),
      textRun("印")
    ]),
    paragraph("連絡先：" + (data.contact || "")),
    heading("2. 設定しようとする運賃及び料金を適用する営業区域", 3),
    paragraph(data.operatingArea || "千葉県"),
    heading("3. 設定しようとする運賃及び料金の種類、額及び適用方法", 3),
    paragraph("・平成14年1月17日付け関東運輸局長公示「一般乗用旅客自動車運送事業の運賃及び料金に関する制度について」1.（1）ニの事前確定運賃を設定する。"),
    paragraph("・運賃額は、平成31年4月26日付け関東運輸局長公示「一般乗用旅客自動車運送事業の事前確定運賃に関する認可申請の取扱いについて」（以下「事前確定運賃公示」という。）3.（2）により関東運輸局長が令和7年7月18日付けで公示した千葉交通圏の係数を用いて、事前確定運賃公示1.（1）の方法により算定する額とする。"),
    paragraph("・適用方法は、事前確定運賃公示1.（2）のとおりとする。"),
    heading("添付書類等", 3),
    ...bulletList([
      "使用する配車アプリ（名称：" + (data.dispatchAppName || "") + "）",
      "事前確定運賃公示2.（3）①に規定する配車アプリの概要を示した資料"
    ])
  ];
}

function buildScreenEvidenceChildren(data, imageMap){
  const children = [
    heading(data.title || "事前確定運賃システム 実画面証跡資料", 1)
  ];
  const info = data.caseInfo || {};
  children.push(kvTable([
    ["見積番号", info.estimateNo || ""],
    ["予約ID", info.reservationId || ""],
    ["確定運賃", info.confirmedFare || ""],
    ["見積日時", info.estimatedAt || ""],
    ["同意日時", info.consentedAt || ""],
    ["出発地", info.origin || ""],
    ["目的地", info.destination || ""],
    ["案件番号", info.projectNumber || ""]
  ]));
  children.push(kvTable([
    ["作成日", data.meta?.createdAt || ""],
    ["作成元", data.meta?.createdBy || ""],
    ["資料区分", data.meta?.documentType || ""]
  ]));
  if(data.verificationNote){
    children.push(paragraph(data.verificationNote, { size: FONT_NOTE }));
  }

  (data.screens || []).forEach(function(screen){
    children.push(pageBreakParagraph());
    children.push(heading(screen.pageTitle || "", 2));
    const buffer = imageMap[screen.imageFile];
    if(buffer){
      const maxWidth = screen.pageId === "meter-reservation-detail" ? 680 : 520;
      children.push(imageParagraph(buffer, { maxWidth: maxWidth }));
    }else{
      children.push(paragraph("（画像ファイル未配置: " + (screen.imageFile || "") + "）"));
    }
    if(screen.proofText){
      children.push(paragraph(screen.proofText));
    }
    if(data.verificationNote){
      children.push(paragraph(data.verificationNote, { size: FONT_NOTE }));
    }
  });

  const supplement = data.supplementPage;
  if(supplement){
    children.push(pageBreakParagraph());
    children.push(heading(supplement.title || "", 2));
    if(supplement.description){
      children.push(paragraph(supplement.description));
    }
    const supplementBuffer = imageMap[supplement.imageFile];
    if(supplementBuffer){
      children.push(imageParagraph(supplementBuffer));
    }else{
      children.push(paragraph("（画像ファイル未配置: " + (supplement.imageFile || "") + "）"));
    }
    if(supplement.proofText){
      children.push(paragraph(supplement.proofText));
    }
    if(data.verificationNote){
      children.push(paragraph(data.verificationNote, { size: FONT_NOTE }));
    }
  }
  return children;
}

function buildQaChildren(data){
  const children = [
    heading(data.title || "事前確定運賃システム 認可説明Q&A", 1),
    paragraph(data.subtitle || ""),
    paragraph("作成日：" + (data.meta?.createdAt || "") + "　作成元：" + (data.meta?.createdBy || "")),
    paragraph(data.introNote || "")
  ];
  if(data.mutuality){
    children.push(heading(data.mutuality.title || "", 2));
    children.push(paragraph(data.mutuality.intro || ""));
    children.push.apply(children, bulletList(data.mutuality.items || []));
  }
  children.push(heading("想定質問と回答", 2));
  (data.qaItems || []).forEach(function(item, index){
    const number = index + 1;
    children.push(paragraph("Q" + number + ". " + (item.q || ""), { bold: true }));
    children.push(paragraph("A" + number + ". " + (item.a || "")));
  });
  if(data.footerNote){
    children.push(paragraph("注意事項：" + data.footerNote, { size: FONT_NOTE }));
  }
  return children;
}

function buildAppendixApplicationHelper(payload){
  const children = [
    heading(payload.title || "事前確定運賃 認可申請様式リンク・記入補助シート", 2),
    paragraph("作成日：" + (payload.meta?.createdAt || "") + "　事業者名：" + (payload.meta?.companyName || "") + "　屋号：" + (payload.meta?.tradeName || ""))
  ];
  children.push.apply(children, bulletList(payload.intro || []));
  children.push(heading("公式リンク欄", 3));
  (payload.officialLinks || []).forEach(function(link){
    children.push(paragraph((link.label || "") + " / " + (link.url || "")));
    if(link.note){
      children.push(paragraph(link.note, { size: FONT_NOTE }));
    }
  });
  children.push(heading("記入補助項目", 3));
  children.push(kvTable(payload.helperFields || []));
  const coefRows = payload.coefficientReferenceRows || payload.meta?.coefficientReferenceRows || [];
  if(coefRows.length){
    children.push(pageBreakParagraph());
    children.push(heading("参考：千葉県内交通圏の平準化係数（申請欄への自動転記ではない）", 3));
    children.push(paragraph("以下はシステム設定値の参考一覧です。申請欄には、申請対象の交通圏に対応する関東運輸局公示の係数を転記してください。", { size: FONT_NOTE }));
    children.push(buildTable(["交通圏", "参考係数"], coefRows, { colWidths: [55, 45], labelCols: [0], amountCols: [1] }));
  }
  if(payload.notice){
    children.push(paragraph(payload.notice, { size: FONT_NOTE }));
  }
  return children;
}

function buildAppendixDistanceFare(payload){
  const children = [
    pageBreakParagraph(),
    heading(payload.title || "別紙1　距離制運賃表", 1),
    paragraph("事業者名：" + (payload.meta?.companyName || "") + "　屋号：" + (payload.meta?.tradeName || ""))
  ];
  children.push.apply(children, bulletList(payload.intro || []));
  children.push(kvTable(payload.fields || []));
  return children;
}

function buildAppendixServiceFee(payload){
  const children = [
    pageBreakParagraph(),
    heading(payload.title || "別紙2　各種料金表", 1)
  ];
  children.push.apply(children, bulletList(payload.intro || []));
  const feeRows = (payload.feeRows || []).map(function(row){
    if(row[0] && String(row[0]).includes("予定時間加算")){
      const next = row.slice();
      next[4] = "LP上の概算見積補助項目。正式な事前確定運賃本体は距離制運賃×平準化係数で算定するものとし、時間距離併用制運賃は用いない。（" + (row[4] || "") + "）";
      return next;
    }
    return row;
  });
  children.push(buildTable(
    ["区分", "金額・単位", "事前確定運賃への含否", "明細表示", "説明", "LP見積での扱い"],
    feeRows,
    {
      colWidths: [14, 14, 14, 12, 24, 22],
      labelCols: [0],
      amountCols: [1]
    }
  ));
  if(payload.sourceNote){
    children.push(paragraph(payload.sourceNote, { size: FONT_NOTE }));
  }
  return children;
}

function buildReviewChecklistChildren(data){
  const rows = (data.checkpoints || []).map(function(item){
    return [
      String(item.no),
      item.point,
      item.content,
      item.document,
      item.status
    ];
  });
  return [
    heading(data.title || "事前確定運賃 認可審査確認ポイント一覧", 1),
    paragraph(data.intro || ""),
    buildTable(
      ["No", "審査確認ポイント", "確認内容", "掲載資料", "状態"],
      rows,
      { colWidths: [6, 14, 34, 32, 14], labelCols: [0, 1], amountCols: [0, 4] }
    )
  ];
}

function buildAttachmentIndexChildren(data){
  return [
    heading(data.title || "添付資料一覧・ページ対応表", 1),
    buildTable(
      ["資料番号", "資料名", "主な確認内容", "掲載ページ", "備考"],
      data.rows || [],
      { colWidths: [12, 22, 34, 14, 18], labelCols: [0], amountCols: [3] }
    ),
    paragraph("※掲載ページは一式提出書類のページ番号です。", { size: FONT_NOTE })
  ];
}

function buildAppendixSetCover(payload){
  return [
    heading(payload.title || "事前確定運賃 提出用別紙セット", 1),
    paragraph("事業者名：" + (payload.meta?.companyName || "") + "　屋号：" + (payload.meta?.tradeName || "")),
    ...bulletList(payload.intro || [])
  ];
}

function createSubmissionDocument(sectionChildrenList){
  const children = [];
  sectionChildrenList.forEach(function(sectionChildren, index){
    if(index > 0){
      children.push(pageBreakParagraph());
    }
    children.push.apply(children, sectionChildren);
  });
  return new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: FONT_BODY }
        }
      }
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: MARGIN_TWIPS,
            right: MARGIN_TWIPS,
            bottom: MARGIN_TWIPS,
            left: MARGIN_TWIPS
          }
        }
      },
      children: children
    }]
  });
}

async function writeDocxFile(doc, filePath){
  const rawBuffer = await Packer.toBuffer(doc);
  const buffer = await normalizeDocxBuffer(rawBuffer);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
  return { filePath: filePath, size: buffer.length };
}

export {
  buildApplicationChildren,
  buildAppendixApplicationHelper,
  buildAppendixDistanceFare,
  buildAppendixServiceFee,
  buildAppendixSetCover,
  buildAttachmentIndexChildren,
  buildQaChildren,
  buildReviewChecklistChildren,
  buildScreenEvidenceChildren,
  createSubmissionDocument,
  htmlToDocxChildren,
  pageBreakParagraph,
  writeDocxFile
};
