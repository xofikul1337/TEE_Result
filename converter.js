const fileInput = document.querySelector("#excel-file");
const dropZone = document.querySelector("#drop-zone");
const fileTitle = document.querySelector("#file-title");
const fileSubtitle = document.querySelector("#file-subtitle");
const sheetControl = document.querySelector("#sheet-control");
const sheetSelect = document.querySelector("#sheet-select");
const convertButton = document.querySelector("#convert-button");
const message = document.querySelector("#converter-message");
const summary = document.querySelector("#summary");
const validRows = document.querySelector("#valid-rows");
const lookupKeys = document.querySelector("#lookup-keys");
const selectedRows = document.querySelector("#selected-rows");
const errorPanel = document.querySelector("#error-panel");
const errorList = document.querySelector("#error-list");

const supportedStatuses = new Set(["SELECTED", "NOT SELECTED", "PENDING", "WAITING", "CANCELLED", "CANCEL"]);
const bengaliDigits = "০১২৩৪৫৬৭৮৯";
let workbook = null;

function normalizeIdentifier(value) {
  return String(value ?? "").trim().replace(/[০-৯]/g, (digit) => String(bengaliDigits.indexOf(digit))).replace(/\s+/g, "").toUpperCase();
}

function resetResult() {
  message.textContent = "";
  summary.hidden = true;
  errorPanel.hidden = true;
  errorList.replaceChildren();
}

async function loadFile(file) {
  resetResult();
  workbook = null;
  convertButton.disabled = true;
  if (!file) return;
  if (file.size > 25 * 1024 * 1024) {
    message.textContent = "File size 25 MB-এর বেশি হতে পারবে না।";
    return;
  }
  try {
    const data = await file.arrayBuffer();
    workbook = XLSX.read(data, { type: "array" });
    if (!workbook.SheetNames.length) throw new Error("Workbook-এ কোনো sheet নেই।");
    sheetSelect.replaceChildren();
    workbook.SheetNames.forEach((sheetName) => {
      const option = document.createElement("option");
      option.value = sheetName;
      option.textContent = sheetName;
      sheetSelect.append(option);
    });
    sheetControl.hidden = workbook.SheetNames.length < 2;
    fileTitle.textContent = file.name;
    fileSubtitle.textContent = `${workbook.SheetNames.length}টি sheet পাওয়া গেছে`;
    dropZone.classList.add("has-file");
    convertButton.disabled = false;
  } catch (error) {
    console.error(error);
    message.textContent = "File-টি পড়া যায়নি। সঠিক Excel বা CSV file নির্বাচন করুন।";
    dropZone.classList.remove("has-file");
  }
}

function buildPublicResults(rows) {
  const output = Object.create(null);
  const errors = [];
  let validCount = 0;
  let selectedCount = 0;
  rows.forEach((row, index) => {
    const excelRow = index + 2;
    const roll = normalizeIdentifier(row["SSC Roll"]);
    const registrationId = normalizeIdentifier(row["Unique ID"]);
    const name = String(row["Student Name"] ?? "").trim();
    const status = String(row.Status ?? "").trim().toUpperCase();
    if (!roll && !registrationId && !name && !status) return;
    if (!status) { errors.push(`Row ${excelRow}: Status খালি।`); return; }
    if (!supportedStatuses.has(status)) { errors.push(`Row ${excelRow}: “${status}” supported status নয়।`); return; }
    if (!roll && !registrationId) { errors.push(`Row ${excelRow}: SSC Roll অথবা Unique ID প্রয়োজন।`); return; }
    if (roll && !/^[0-9]{4,12}$/.test(roll)) { errors.push(`Row ${excelRow}: SSC Roll “${roll}” সঠিক নয়।`); return; }
    if (registrationId && !/^TEE[0-9]{2}-[0-9]{4}$/.test(registrationId)) { errors.push(`Row ${excelRow}: Unique ID “${registrationId}” সঠিক নয়।`); return; }
    if (status === "SELECTED" && !name) { errors.push(`Row ${excelRow}: নির্বাচিত শিক্ষার্থীর Student Name খালি।`); return; }
    const identifiers = [roll, registrationId].filter(Boolean);
    const duplicate = identifiers.find((identifier) => Object.hasOwn(output, identifier));
    if (duplicate) { errors.push(`Row ${excelRow}: “${duplicate}” duplicate identifier।`); return; }
    const publicRecord = { status };
    if (status === "SELECTED") publicRecord.name = name;
    identifiers.forEach((identifier) => { output[identifier] = publicRecord; });
    validCount += 1;
    if (status === "SELECTED") selectedCount += 1;
  });
  return { output, errors, validCount, selectedCount };
}

function downloadJson(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "public-results.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

convertButton.addEventListener("click", () => {
  resetResult();
  if (!workbook) return;
  const sheetName = sheetSelect.value || workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "", raw: false });
  const result = buildPublicResults(rows);
  validRows.textContent = String(result.validCount);
  lookupKeys.textContent = String(Object.keys(result.output).length);
  selectedRows.textContent = String(result.selectedCount);
  summary.hidden = false;
  if (result.errors.length) {
    result.errors.slice(0, 100).forEach((error) => {
      const item = document.createElement("li");
      item.textContent = error;
      errorList.append(item);
    });
    if (result.errors.length > 100) {
      const item = document.createElement("li");
      item.textContent = `আরও ${result.errors.length - 100}টি error আছে।`;
      errorList.append(item);
    }
    errorPanel.hidden = false;
    message.textContent = `${result.errors.length}টি error ঠিক না করা পর্যন্ত JSON download হবে না।`;
    return;
  }
  if (!result.validCount) { message.textContent = "কোনো valid data row পাওয়া যায়নি।"; return; }
  downloadJson(result.output);
  message.textContent = "JSON সফলভাবে তৈরি হয়েছে। Download শুরু হয়েছে।";
});

fileInput.addEventListener("change", () => loadFile(fileInput.files[0]));
["dragenter", "dragover"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropZone.classList.add("is-dragging");
}));
["dragleave", "drop"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-dragging");
}));
dropZone.addEventListener("drop", (event) => {
  const [file] = event.dataTransfer.files;
  if (file) loadFile(file);
});
