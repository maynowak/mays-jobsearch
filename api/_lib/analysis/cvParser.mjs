// Generated from src/lib/cvBuilder/pdfImport.ts, documentStructure.ts and contractTypes.ts.
// Do not hand-edit; source files remain the source of truth.
//#region src/lib/cvBuilder/documentStructure.ts
function buildPdfDocument(pages) {
	let order = 0;
	const documentPages = pages.map((page) => {
		const blocks = (page.lines.length ? page.lines : page.text.split("\n").map((text, index) => ({
			text,
			order: index
		})).filter((line) => line.text.trim())).filter((line) => line.text.trim()).map((line) => {
			const text = line.text.trim();
			return {
				page: page.page,
				order: order++,
				text,
				lines: [text],
				...Number.isFinite(line.fontSize) ? { fontSize: line.fontSize } : {}
			};
		});
		return {
			page: page.page,
			text: page.text.trim(),
			blocks
		};
	});
	return {
		pageCount: documentPages.length,
		text: documentPages.map((page) => page.text).join("\n\n").trim(),
		pages: documentPages,
		blocks: documentPages.flatMap((page) => page.blocks)
	};
}
const CONTINUED_SUFFIX = /\s*(?:[–—\-]\s*)?(?:\((?:fortsetzung|continued)\)|fortsetzung|continued|cont\.?)\s*$/i;
const PAGE_NUMBER_LINE = /^(?:seite|page|p\.?)\s*\d+(?:\s*(?:von|of|\/)\s*\d+)?$/i;
const PAGE_NUMBER_SUFFIX = /\b(?:seite|page)\s+\d+(?:\s*(?:von|of|\/)\s*\d+)?\s*$/i;
const BARE_PAGE_NUMBER = /^\d{1,3}(?:\s*\/\s*\d{1,3})?$/;
function cleanHeadingText(text) {
	return text.replace(/^[-•*–—]\s*/, "").replace(/[:：]\s*$/, "").replace(/\s+/g, " ").trim();
}
function headingSignature(text) {
	return cleanHeadingText(text).toLocaleLowerCase("de").replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
}
function isPurePageNumberLine(text) {
	const line = cleanHeadingText(text);
	return PAGE_NUMBER_LINE.test(line) || BARE_PAGE_NUMBER.test(line);
}
function categoryForPart(part) {
	const value = part.toLocaleLowerCase("de").replace(/\s+/g, " ").trim();
	if (!value) return null;
	if (/\b(?:zielposition\w*|zielrollen|zielrolle|target roles?|target positions?)\b/.test(value)) return "target-roles";
	if (/\b(?:profile note|publication note|ats note|veröffentlichungshinweis\w*|veroeffentlichungshinweis\w*)\b/.test(value)) return "document-notes";
	if (/\b(?:profil\w*|summary|zusammenfassung|über mich|ueber mich|about me|professional strengths|strengths)\b/.test(value)) return "profile";
	if (/\b(?:aws\s*qa\s*lab\w*|qa\s*lab\w*|labor\w*|lab\w*|training|praxisorientierte\w*|cloud-qualifizierung|qualifizierung)\b/.test(value)) return "training";
	if (/\b(?:projekt\w*|project\w*)\b/.test(value)) return "projects";
	if (/\b(?:professional development|hands-on practice|additional aws)\b/.test(value)) return "training";
	if (/\b(?:kernkompetenz\w*|kompetenz\w*|fähigkeit\w*|faehigkeit\w*|kenntnis\w*|skill\w*|competenc\w*|suchbegriff\w*|architektur\w*|architecture|cloud|technolog\w*|distributed systems|enterprise integration|focus areas|data\s*&\s*integration|development|php|html|css|javascript|typescript|java|python|node\.js|integration)\b/.test(value)) return "skills";
	if (/\b(?:weiterbildung\w*|zertifikat\w*|zertifizierung\w*|certification\w*|certificate\w*|fortbildung\w*|further education|continuing education|courses?|professional development|hands-on practice)\b/.test(value)) return "certificates";
	if (/\b(?:beruflicher werdegang|berufserfahrung\w*|arbeitserfahrung\w*|werdegang|professional experience|work experience|employment history|timeline)\b/.test(value)) return "experience";
	if (/\b(?:ausbildung\w*|education|qualifikation\w*|qualification\w*)\b/.test(value)) return "education";
	if (/\b(?:sprache\w*|language\w*)\b/.test(value)) return "languages";
	if (/\b(?:link\w*|website\w*|portfolio|online profile\w*)\b/.test(value)) return "links";
	if (/\b(?:hinweis\w*|veröffentlichung\w*|veroeffentlichung\w*|publication\w*|notes?)\b/.test(value)) return "document-notes";
	if (/\b(?:sonstiges|weitere angaben|additional information|misc)\b/.test(value)) return "misc";
	return null;
}
function headingParts(text) {
	return text.split(/\s*(?:&|\+|,|\/|\bund\b|\band\b)\s*/i).flatMap((part) => part.split(/\s+[–—]\s+/)).map((part) => part.trim()).filter(Boolean);
}
const EXACT_HEADING_ALIASES = /* @__PURE__ */ new Set([
	"personal",
	"personal details",
	"personal data",
	"contact",
	"kontakt",
	"persönliche daten",
	"persoenliche daten",
	"profil",
	"profile",
	"professional summary",
	"summary",
	"berufliches profil",
	"über mich",
	"ueber mich",
	"about me",
	"selected professional strengths",
	"professional strengths",
	"zielpositionen",
	"zielrollen",
	"target roles",
	"target positions",
	"kernkompetenzen",
	"kompetenzen",
	"fähigkeiten",
	"faehigkeiten",
	"kenntnisse",
	"technische kenntnisse",
	"skills",
	"technical skills",
	"core skills",
	"core competencies",
	"competencies",
	"architecture",
	"software architecture",
	"solution architecture",
	"architecture & cloud",
	"architektur",
	"cloud",
	"cloud architecture",
	"technologies",
	"technology",
	"technical technologies",
	"distributed systems",
	"enterprise integration",
	"focus areas",
	"data & integration",
	"development",
	"additional aws hands-on practice",
	"projekte",
	"project",
	"projects",
	"project experience",
	"project work",
	"projektarbeit",
	"selected current projects",
	"selected projects",
	"current projects",
	"key projects",
	"relevant projects",
	"berufserfahrung",
	"berufliche erfahrung",
	"arbeitserfahrung",
	"beruflicher werdegang",
	"werdegang",
	"work experience",
	"professional experience",
	"employment history",
	"work history",
	"experience",
	"ausbildung",
	"bildung",
	"bildungsweg",
	"akademische ausbildung",
	"education",
	"academic background",
	"professional development",
	"selected professional strengths",
	"profile note",
	"education and qualifications",
	"education & qualifications",
	"education & certifications",
	"qualifications",
	"weiterbildung",
	"weiterbildungen",
	"fortbildung",
	"fortbildungen",
	"further education",
	"continuing education",
	"zertifikate",
	"zertifizierungen",
	"zertifikatsstatus",
	"certificates",
	"certifications",
	"courses",
	"sprachen",
	"sprachkenntnisse",
	"languages",
	"language skills",
	"links",
	"websites",
	"portfolio",
	"online profiles",
	"hinweise",
	"veröffentlichungshinweise",
	"veroeffentlichungshinweise",
	"document notes",
	"publication notes",
	"notes",
	"profile note",
	"sonstiges",
	"weitere angaben",
	"additional information",
	"misc"
]);
function headingShapeAllowed(value, continued) {
	if (/@|https?:\/\//i.test(value)) return false;
	if (/^[-•*–—]/.test(value)) return false;
	if (/[;]$/.test(value)) return false;
	if (/\b\d{1,2}[./]\d{4}\b/.test(value) && !uppercaseHeadingLike(value)) return false;
	if (/^\d{4}\s*(?:[-–—]|\|)/.test(value) && !uppercaseHeadingLike(value)) return false;
	if (/^(?:jan|feb|mär|maerz|apr|mai|jun|jul|aug|sep|okt|oct|nov|dez|dec)\w*\.?\s+\d{4}/i.test(value) && !uppercaseHeadingLike(value)) return false;
	const words = value.split(/\s+/).filter(Boolean);
	if (words.length > 14) return false;
	if (uppercaseHeadingLike(value)) return true;
	const normalized = value.toLocaleLowerCase("de").replace(/\s+/g, " ").trim();
	return EXACT_HEADING_ALIASES.has(normalized) && (continued || words.length <= 6);
}
function matchDocumentHeading(text) {
	let value = cleanHeadingText(text);
	if (!value || value.length > 110) return null;
	const continued = CONTINUED_SUFFIX.test(value);
	if (continued) value = value.replace(CONTINUED_SUFFIX, "").trim();
	if (!value || !headingShapeAllowed(value, continued)) return null;
	const parts = headingParts(value);
	const categories = parts.some((part) => /(?:projekt|project)/i.test(part)) ? ["projects"] : [...new Set(parts.map(categoryForPart).filter((part) => Boolean(part)))];
	if (!categories.length) return null;
	const category = categories.length > 1 ? "mixed" : categories[0];
	return {
		category,
		categories,
		continued,
		uncertain: category === "mixed" || category === "training" || category === "unknown"
	};
}
function uppercaseHeadingLike(text) {
	const letters = [...cleanHeadingText(text)].filter((character) => /\p{L}/u.test(character));
	if (letters.length < 3) return false;
	return letters.filter((character) => character === character.toLocaleUpperCase("de")).length / letters.length >= .78;
}
function isLikelyUnknownHeading(text) {
	const value = cleanHeadingText(text);
	if (!value || value.length > 100) return false;
	if (!uppercaseHeadingLike(value)) return false;
	if (/^[-•*–—]/.test(text)) return false;
	if (/[.!?]$/.test(value)) return false;
	if (/@|https?:\/\//i.test(value)) return false;
	if (/\b(?:gmbh|ag|inc|ltd|llc|corp|kg|ug|ohg|gbr)\b/i.test(value)) return false;
	if (/^(?:seite|page)\s+\d+/i.test(value)) return false;
	if (value.split(/\s+/).filter(Boolean).length < 2) return false;
	return value.length >= 20 || /[&,–—/]/.test(value) || /\b(?:schwerpunkt|station|stationen|übersicht|uebersicht|status|profil|kompetenz|qualifikation|hinweis|projekt|erfahrung|ausbildung|sprache|zertifikat|weiterbildung)\b/i.test(value);
}
function edgeLines(source) {
	const result = [];
	for (const page of source.pages) {
		const blocks = page.blocks.filter((block) => block.text.trim());
		for (const block of blocks.slice(0, 2)) result.push({
			block,
			edge: "top",
			signature: headingSignature(block.text)
		});
		for (const block of blocks.slice(-2)) result.push({
			block,
			edge: "bottom",
			signature: headingSignature(block.text)
		});
	}
	return result;
}
function normalizePdfDocument(source) {
	const edges = edgeLines(source);
	const signatures = /* @__PURE__ */ new Map();
	for (const edge of edges) {
		const pages = signatures.get(edge.signature) ?? /* @__PURE__ */ new Set();
		pages.add(edge.block.page);
		signatures.set(edge.signature, pages);
	}
	const repeatedSignatures = new Set(source.pageCount >= 2 ? [...signatures.entries()].filter(([, pages]) => pages.size >= 2).map(([signature]) => signature) : []);
	const ignored = [];
	const lines = [];
	for (const block of source.blocks) {
		const text = block.text.trim();
		if (!text) {
			lines.push({
				block,
				kind: "content"
			});
			continue;
		}
		if (isPurePageNumberLine(text)) {
			ignored.push({
				block,
				reason: "page-number"
			});
			continue;
		}
		if (PAGE_NUMBER_SUFFIX.test(text)) {
			ignored.push({
				block,
				reason: "page-header"
			});
			continue;
		}
		const knownHeading = matchDocumentHeading(text);
		const unknownHeading = !knownHeading && isLikelyUnknownHeading(text);
		const edge = edges.find((candidate) => candidate.block.order === block.order);
		const headerLike = /(?:[•|].*\d+|\b(?:seite|page)\s+\d+)\s*$/i.test(text);
		if (edge && repeatedSignatures.has(edge.signature) && (!knownHeading || headerLike)) {
			if (!(edge.edge === "top" && unknownHeading && !headerLike)) {
				ignored.push({
					block,
					reason: edge.edge === "top" ? "page-header" : "page-footer"
				});
				continue;
			}
		}
		lines.push({
			block,
			kind: knownHeading || unknownHeading ? "heading" : "content",
			...knownHeading ? { heading: knownHeading } : {}
		});
	}
	return {
		source,
		lines,
		ignored
	};
}
function sameHeading(left, right) {
	return headingSignature(left) === headingSignature(right);
}
const DATE_RANGE_AT_START = /^\s*((?:(?:0?[1-9]|1[0-2])[./])?(?:19|20)\d{2}\s*(?:[-–—]|bis|to)\s*(?:(?:0?[1-9]|1[0-2])[./])?(?:(?:19|20)\d{2}|heute|present|current|now|ongoing))\b/i;
const SINGLE_DATE_AT_START = /^\s*((?:(?:0?[1-9]|1[0-2])[./])?(?:19|20)\d{2})\s*(?:\||·|–|—)/i;
const TRAINING_LINE_RE = /\b(?:lab|training|weiterbildung|fortbildung|course|workshop|seminar|zertifizierung\w*|certification\w*|in preparation|preparing for|planned|in progress|pursuing|geplant|in vorbereitung|angestrebt)\b/i;
function isTrainingContentLine(line) {
	return TRAINING_LINE_RE.test(line) && !/^[-•*–—]/.test(line) && !/[.!?]$/.test(line) && line.split(/\s+/).filter(Boolean).length <= 14;
}
function startDate(line) {
	const range = line.match(DATE_RANGE_AT_START);
	if (range) {
		const current = /heute|present|current|now|ongoing/i.test(range[1]);
		const hasMonthInStart = /^(?:0?[1-9]|1[0-2])[./]/.test(range[1]);
		return {
			dateText: range[1].trim(),
			current,
			uncertain: !hasMonthInStart
		};
	}
	const single = line.match(SINGLE_DATE_AT_START);
	if (single) return {
		dateText: single[1].trim(),
		current: false,
		uncertain: true
	};
	return null;
}
function timelineKind(line) {
	if (/\b(?:freelance|freiberuflich|selbstständig|selbststaendig|self[- ]employed)\b/i.test(line)) return "freelance";
	if (/\b(?:training|kurs|course|workshop|seminar|weiterbildung|fortbildung|lab|labor|zertifizierung\w*|certification\w*)\b/i.test(line)) return "training";
	if (/\b(?:projekt\w*|project\w*|projektphase)\b/i.test(line)) return "project";
	if (/\b(?:ausbildung|studium|bachelor|master|diplom|phd|doktor|zertifikat\w*|qualifikation\w*)\b/i.test(line)) return "qualification";
	return "employment";
}
function detectTimelineItems(blocks) {
	const items = [];
	let current = null;
	let itemIndex = 0;
	let lastFreelance = null;
	const startItem = (block, kind) => {
		const item = {
			id: `timeline-${itemIndex++}`,
			kind,
			page: block.page,
			lines: [block.text],
			dateText: "",
			current: false,
			uncertainDate: true
		};
		items.push(item);
		current = item;
		return item;
	};
	for (const block of blocks) {
		if (!block.text.trim()) {
			current = null;
			continue;
		}
		const date = startDate(block.text);
		if (date && current && !current.dateText) {
			current.lines.push(block.text);
			current.dateText = date.dateText;
			current.current = date.current;
			current.uncertainDate = date.uncertain;
			current.kind = timelineKind(block.text);
			if (current.kind === "project" && lastFreelance) current.parentId = lastFreelance.id;
			if (current.kind === "freelance") lastFreelance = current;
			if (current.kind !== "freelance" && current.kind !== "project") lastFreelance = null;
			continue;
		}
		if (date) {
			const kind = timelineKind(block.text);
			const item = startItem(block, kind);
			item.dateText = date.dateText;
			item.current = date.current;
			item.uncertainDate = date.uncertain;
			if (kind === "project" && lastFreelance) item.parentId = lastFreelance.id;
			if (kind === "freelance") lastFreelance = item;
			if (kind !== "project" && kind !== "freelance") lastFreelance = null;
			continue;
		}
		if (isTrainingContentLine(block.text) && (!current || current.kind !== "training")) {
			current = startItem(block, "training");
			continue;
		}
		if (!current) {
			current = startItem(block, "unclear");
			continue;
		}
		current.lines.push(block.text);
	}
	return items;
}
function detectDocumentSections(normalized) {
	const sections = [];
	let current = null;
	let sectionIndex = 0;
	const startSection = (line, category, categories, heading, uncertain, continued) => {
		const section = {
			id: `section-${sectionIndex++}`,
			category,
			categories,
			heading,
			headingBlocks: [line.block],
			pageStart: line.block.page,
			pageEnd: line.block.page,
			blocks: [],
			uncertain,
			continued
		};
		sections.push(section);
		return section;
	};
	for (const line of normalized.lines) {
		if (line.kind === "heading" && current?.category === "skills" && line.heading?.category === "skills") {
			current.blocks.push(line.block);
			current.pageEnd = Math.max(current.pageEnd, line.block.page);
			continue;
		}
		if (line.kind === "heading") {
			const known = line.heading;
			const category = known?.category ?? "unknown";
			const categories = known?.categories ?? ["unknown"];
			if (current !== null && current.category === category && (Boolean(known?.continued) || sameHeading(current.heading, line.block.text)) && current) {
				current.continued = true;
				current.headingBlocks.push(line.block);
				current.pageEnd = Math.max(current.pageEnd, line.block.page);
				if (known?.uncertain) current.uncertain = true;
				continue;
			}
			current = startSection(line, category, categories, line.block.text, known?.uncertain ?? true, Boolean(known?.continued));
			continue;
		}
		if (!current) current = startSection(line, "personal", ["personal"], "Kopfdaten", false, false);
		current.blocks.push(line.block);
		current.pageEnd = Math.max(current.pageEnd, line.block.page);
	}
	return sections.map((section) => section.category === "experience" ? {
		...section,
		timeline: detectTimelineItems(section.blocks)
	} : section);
}
function documentFromText(raw) {
	const sourceLines = raw.replace(/\r/g, "").split("\n");
	let order = 0;
	const blocks = sourceLines.map((text) => ({
		page: 1,
		order: order++,
		text: text.trim(),
		lines: [text.trim()]
	}));
	return {
		pageCount: 1,
		text: raw.trim(),
		pages: [{
			page: 1,
			text: raw.trim(),
			blocks
		}],
		blocks
	};
}
function detectCvDocument(source) {
	const normalized = normalizePdfDocument(source);
	const sections = detectDocumentSections(normalized);
	const used = /* @__PURE__ */ new Set();
	for (const section of sections) {
		for (const block of section.headingBlocks) used.add(block.order);
		for (const block of section.blocks) used.add(block.order);
	}
	const ignored = new Set(normalized.ignored.map((entry) => entry.block.order));
	const unknownCategories = /* @__PURE__ */ new Set([
		"unknown",
		"target-roles",
		"training",
		"document-notes",
		"misc"
	]);
	return {
		pageCount: source.pageCount,
		sections,
		ignored: normalized.ignored,
		sourceBlocks: source.blocks,
		unknownBlocks: sections.filter((section) => unknownCategories.has(section.category)).flatMap((section) => section.blocks),
		unusedBlocks: source.blocks.filter((block) => !used.has(block.order) && !ignored.has(block.order)),
		uncertainSections: sections.filter((section) => section.uncertain)
	};
}
function newId(prefix) {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `${prefix}-${crypto.randomUUID()}`;
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
function createEmptyCvBuilderDraft() {
	return {
		schemaVersion: 1,
		personal: {},
		profile: {},
		experience: [],
		education: [],
		skills: [],
		projects: [],
		certificates: [],
		languages: [],
		links: []
	};
}
function createExperienceEntry() {
	return {
		id: newId("exp"),
		employer: "",
		position: "",
		startMonth: "",
		current: false
	};
}
function createEducationEntry() {
	return {
		id: newId("edu"),
		institution: "",
		degree: "",
		startMonth: "",
		current: false
	};
}
function createProjectEntry() {
	return {
		id: newId("project"),
		name: "",
		technologies: []
	};
}
function createCertificateEntry() {
	return {
		id: newId("cert"),
		name: ""
	};
}
function createLanguageEntry() {
	return {
		id: newId("lang"),
		language: "",
		level: "professional"
	};
}
function createLinkEntry() {
	return {
		id: newId("link"),
		kind: "portfolio",
		label: "",
		url: ""
	};
}
//#endregion
//#region src/lib/cvBuilder/pdfImport.ts
const CV_BUILDER_IMPORT_SECTIONS = [
	"personal",
	"profile",
	"experience",
	"education",
	"skills",
	"projects",
	"certificates",
	"languages",
	"links"
];
const SECTION_ALIASES = {
	personal: [
		"persönliche daten",
		"persoenliche daten",
		"persönliches",
		"kontakt",
		"personal details",
		"personal data",
		"contact"
	],
	profile: [
		"profil",
		"profilzusammenfassung",
		"berufliches profil",
		"über mich",
		"ueber mich",
		"summary",
		"profile",
		"about me",
		"professional summary"
	],
	experience: [
		"berufserfahrung",
		"berufliche erfahrung",
		"arbeitserfahrung",
		"beruflicher werdegang",
		"werdegang",
		"work experience",
		"experience",
		"employment history",
		"professional experience"
	],
	education: [
		"ausbildung",
		"bildung",
		"bildungsweg",
		"akademische ausbildung",
		"education",
		"academic background",
		"qualifications"
	],
	skills: [
		"fähigkeiten",
		"faehigkeiten",
		"kenntnisse",
		"technische kenntnisse",
		"skills",
		"technical skills",
		"competencies",
		"core skills"
	],
	projects: [
		"projekte",
		"project experience",
		"projects",
		"project work",
		"project experience / projects"
	],
	certificates: [
		"zertifikate",
		"zertifizierungen",
		"weiterbildungen",
		"weiterbildung",
		"fortbildung",
		"fortbildungen",
		"certificates",
		"certifications",
		"courses",
		"further education",
		"continuing education"
	],
	languages: [
		"sprachen",
		"sprachkenntnisse",
		"languages",
		"language skills"
	],
	links: [
		"links",
		"websites",
		"portfolio",
		"profile links",
		"online profiles"
	]
};
const SECTION_PATTERNS = [
	[/^(?:selected|current|key|relevant)(?:\s+current)?\s+projects?$/i, "projects"],
	[/^(?:projects?|project experience|project work|projekte|projektarbeit)$/i, "projects"],
	[/^(?:professional|work|employment)\s+(?:experience|history)$/i, "experience"],
	[/^(?:work history|employment history|berufserfahrung|berufliche erfahrung|arbeitserfahrung|beruflicher werdegang|werdegang)$/i, "experience"],
	[/^(?:education(?: and qualifications)?|education\s*[&+]\s*certifications?|academic background|ausbildung|bildung|bildungsweg|akademische ausbildung)$/i, "education"],
	[/^(?:further education|continuing education|weiterbildung|fortbildung|weiterbildungen|schulungen?)$/i, "certificates"],
	[/^(?:technical skills|core competencies|key skills|technical competencies|skills|fähigkeiten|faehigkeiten|kenntnisse|technische kenntnisse|cloud\s*[&+]\s*devops)$/i, "skills"],
	[/^(?:certificates?|certifications?|zertifikate|zertifizierungen)$/i, "certificates"],
	[/^(?:languages?|language skills|sprachen|sprachkenntnisse)$/i, "languages"],
	[/^(?:links?|websites?|portfolios?|online profiles?)$/i, "links"]
];
const MONTHS = {
	jan: "01",
	januar: "01",
	january: "01",
	feb: "02",
	februar: "02",
	february: "02",
	mar: "03",
	mär: "03",
	maerz: "03",
	märz: "03",
	march: "03",
	apr: "04",
	april: "04",
	mai: "05",
	may: "05",
	jun: "06",
	juni: "06",
	june: "06",
	jul: "07",
	juli: "07",
	july: "07",
	aug: "08",
	august: "08",
	sep: "09",
	sept: "09",
	september: "09",
	okt: "10",
	oktober: "10",
	october: "10",
	oct: "10",
	nov: "11",
	november: "11",
	dez: "12",
	dezember: "12",
	december: "12",
	dec: "12"
};
const DATE_POINT = `(?:(?:jan(?:uar)?|feb(?:ruar)?|mär(?:z)?|maerz|apr(?:il)?|mai|may|jun(?:i)?|jul(?:i)?|aug(?:ust)?|sep(?:t|tember)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|dez(?:ember)?|dec(?:ember)?)\\.?\\s+\\d{4}|\\d{1,2}[./]\\d{4}|\\d{4}[-/]\\d{2}|\\d{4})`;
const DATE_END = `(?:${DATE_POINT}|present|heute|current|now|ongoing|bis heute)`;
const DATE_RANGE = new RegExp(`(${DATE_POINT})\\s*(?:-|–|—|bis|to)\\s*(${DATE_END})`, "i");
const SINCE_DATE = new RegExp(`^(?:seit|since)\\s+(${DATE_POINT})`, "i");
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d ()/.-]{6,}\d)/;
const LINK_RE = /(https?:\/\/[^\s<>()]+|(?:www\.)?(?:github|linkedin)\.com\/[^\s<>()]+)/i;
const MONTH_RE = /^(\d{4})-(\d{2})$/;
function linksInLine(line) {
	return [...line.matchAll(new RegExp(LINK_RE.source, "gi"))].map((match) => match[1]).filter(Boolean);
}
function linkEntry(url) {
	let normalized = url.replace(/[.,;)]$/, "");
	if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
	const lower = normalized.toLocaleLowerCase("en");
	const kind = lower.includes("github") ? "github" : lower.includes("linkedin") ? "linkedin" : "portfolio";
	let label;
	try {
		const parsed = new URL(normalized);
		const segments = parsed.pathname.split("/").filter(Boolean);
		if (kind === "github") label = segments.length >= 2 ? `GitHub · ${segments[0]}/${segments[1]}` : `GitHub · ${parsed.hostname}`;
		else if (kind === "linkedin") {
			const profile = segments[0] === "in" ? segments[1] : segments[0];
			label = profile ? `LinkedIn · ${profile}` : `LinkedIn · ${parsed.hostname}`;
		} else label = `Portfolio · ${parsed.hostname}${segments.length ? `/${segments.at(-1)}` : ""}`;
	} catch {
		label = kind === "github" ? "GitHub" : kind === "linkedin" ? "LinkedIn" : "Portfolio";
	}
	return {
		...createLinkEntry(),
		kind,
		label,
		url: normalized
	};
}
function normalizedHeading(line) {
	return line.replace(/^[-•*]\s*/, "").replace(/[:：]\s*$/, "").replace(/\s+/g, " ").replace(/\s*\((?:continued|fortsetzung)\)\s*$/i, "").trim().toLocaleLowerCase("de");
}
function sectionFor(line) {
	const candidates = [line, line.split(/\s{2,}/)[0]];
	for (const candidate of candidates) {
		const normalized = normalizedHeading(candidate);
		if (!normalized || normalized.length > 80) continue;
		for (const section of CV_BUILDER_IMPORT_SECTIONS) if (SECTION_ALIASES[section].includes(normalized)) return section;
		for (const [pattern, section] of SECTION_PATTERNS) if (pattern.test(normalized)) return section;
	}
	return null;
}
function preprocessLines(raw) {
	const lines = raw.replace(/\r/g, "").split("\n").map((line) => line.trim());
	const counts = /* @__PURE__ */ new Map();
	for (const line of lines) {
		if (!line || sectionFor(line)) continue;
		const key = normalizedHeading(line);
		if (key.length <= 80) counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	const repeated = new Set([...counts.entries()].filter(([line, count]) => count >= 3 && line.length < 80).map(([line]) => line));
	return lines.filter((line) => {
		if (!line) return true;
		if (/^\d{1,3}$/.test(line)) return false;
		if (/^(seite|page)\s+\d+(\s*(von|of)\s*\d+)?$/i.test(line)) return false;
		if (/^(curriculum vitae|lebenslauf)$/i.test(line) && (counts.get(normalizedHeading(line)) ?? 0) > 1) return false;
		if (/^(?:.*\s[·|]\s)?(?:professional cv|professional profile|curriculum vitae)\s+\d+$/i.test(line)) return false;
		if (/^(?:seite|page)\s+\d+$/i.test(line)) return false;
		return !repeated.has(normalizedHeading(line));
	});
}
function mergeWrappedLines(lines) {
	const merged = [];
	for (const line of lines) {
		if (!line) {
			merged.push("");
			continue;
		}
		const previous = merged[merged.length - 1];
		const startsLikeContinuation = /^[a-zäöüß]/.test(line);
		const isBullet = /^[-•*–—]/.test(line);
		if (previous && startsLikeContinuation && !isBullet && !sectionFor(previous) && !LINK_RE.test(previous) && !LINK_RE.test(line) && !EMAIL_RE.test(line) && !PHONE_RE.test(line) && !/[.!?:]$/.test(previous) && previous.length < 180) merged[merged.length - 1] = `${previous} ${line}`;
		else merged.push(line);
	}
	return merged;
}
function cleanLine(line) {
	return line.replace(/^[-•*–—]\s*/, "").replace(/\s+/g, " ").trim();
}
function nonEmpty(lines) {
	return lines.map(cleanLine).filter(Boolean);
}
function emptyDetected() {
	return Object.fromEntries(CV_BUILDER_IMPORT_SECTIONS.map((section) => [section, false]));
}
function emptyUncertain() {
	return Object.fromEntries(CV_BUILDER_IMPORT_SECTIONS.map((section) => [section, false]));
}
function splitBlocks(lines) {
	const blocks = [];
	let current = [];
	for (const line of lines) {
		if (!line.trim()) {
			if (current.length) {
				blocks.push(current);
				current = [];
			}
			continue;
		}
		current.push(line);
	}
	if (current.length) blocks.push(current);
	return blocks;
}
function isProjectStart(line) {
	return /^\d{4}(?:\s*[-–—]\s*\d{4})?\s*(?:\||[–—])\s*/.test(cleanLine(line));
}
function splitProjectBlocks(lines) {
	if (lines.filter((line) => line.trim()).filter(isProjectStart).length < 2) return splitBlocks(lines);
	const blocks = [];
	let current = [];
	for (const line of lines) {
		if (!line.trim()) continue;
		if (isProjectStart(line) && current.length) {
			blocks.push(current);
			current = [line];
		} else current.push(line);
	}
	if (current.length) blocks.push(current);
	return blocks;
}
function splitLineParts(line) {
	return line.split(/\s*(?:\||·|–|—| - )\s*/).map(cleanLine).filter(Boolean);
}
function parseMonthToken(token) {
	const value = token.trim().toLocaleLowerCase("de").replace(/\.$/, "");
	if (/^\d{4}$/.test(value)) return "";
	const iso = value.match(MONTH_RE);
	if (iso) return `${iso[1]}-${iso[2]}`;
	const slashIso = value.match(/^(\d{4})\/(\d{2})$/);
	if (slashIso) {
		const month = Number(slashIso[2]);
		return month >= 1 && month <= 12 ? `${slashIso[1]}-${String(month).padStart(2, "0")}` : "";
	}
	const numeric = value.match(/^(\d{1,2})[./](\d{4})$/);
	if (numeric) {
		const month = Number(numeric[1]);
		return month >= 1 && month <= 12 ? `${numeric[2]}-${String(month).padStart(2, "0")}` : "";
	}
	const named = value.match(/^([a-zä]+)\.?\s+(\d{4})$/);
	if (named) {
		const month = MONTHS[named[1]];
		return month ? `${named[2]}-${month}` : "";
	}
	return null;
}
function parseDateRange(line) {
	const range = line.match(DATE_RANGE);
	if (range && range.index !== void 0) {
		const startMonth = parseMonthToken(range[1]);
		const endToken = range[2].trim().toLocaleLowerCase("de");
		const current = /present|heute|current|now|ongoing|bis heute/.test(endToken);
		const endMonth = current ? void 0 : parseMonthToken(range[2]);
		return {
			startMonth: startMonth ?? "",
			endMonth: endMonth ?? void 0,
			current,
			uncertain: !startMonth || !current && !endMonth,
			matchIndex: range.index
		};
	}
	const since = line.match(SINCE_DATE);
	if (since && since.index !== void 0) {
		const startMonth = parseMonthToken(since[1]);
		return {
			startMonth: startMonth ?? "",
			current: true,
			uncertain: !startMonth,
			matchIndex: since.index
		};
	}
	return null;
}
function companyLike(value) {
	return /\b(gmbh|ag|inc|ltd|llc|corp|company|kg|ug|ohg|gbr|universität|university|hochschule|college|school|akademie|institut)\b/i.test(value);
}
function titleLike(value) {
	return /\b(engineer|developer|manager|consultant|analyst|designer|architect|architekt|leiter|leitung|spezialist|specialist|praktikant|intern|assistant|berater|referent|director|lead|head|scientist|techniker|pflegefachkraft)\b/i.test(value);
}
function roleLike(value) {
	return titleLike(value) || /\b(devops|sre|cloud|platform|integration|e-commerce|ecommerce|web services|software|data|operations|administrator|architektur|architecture)\b/i.test(value);
}
function classifyExperiencePair(first, second) {
	if (companyLike(first) && !companyLike(second)) return {
		employer: first,
		position: second,
		uncertain: !roleLike(second)
	};
	if (roleLike(first) && !roleLike(second)) return {
		employer: second,
		position: first,
		uncertain: !second
	};
	if (roleLike(second) && !roleLike(first)) return {
		employer: first,
		position: second,
		uncertain: false
	};
	return {
		employer: first,
		position: second,
		uncertain: !roleLike(second)
	};
}
function degreeLike(value) {
	return /\b(bachelor|master|b\.?sc|m\.?sc|b\.?a|m\.?a|diplom|phd|doktor|doctor|staatsexamen|ausbildung|lehre|abitur|fachabitur|fachwirt|mba|vocational qualification|berufsqualifikation|berufsausbildung|high school diploma|secondary school|university degree|hochschulabschluss)\b/i.test(value);
}
const NON_EMPLOYMENT_RE = /\b(lab|labor|bootcamp|course|kurs|training|schulung|seminar|workshop|weiterbildung|fortbildung|certification|zertifizierung|universität|universitaet|university|hochschule|college|school|studium|education)\b/i;
function parseExperience(lines, uncertain, unrecognized) {
	const entries = [];
	for (const block of splitBlocks(lines)) {
		const dateIndex = block.findIndex((line) => parseDateRange(line) !== null || /^\s*\d{4}\s*\|/.test(line));
		if (dateIndex < 0) {
			unrecognized.push(...nonEmpty(block));
			continue;
		}
		const dateLine = block[dateIndex];
		let date = parseDateRange(dateLine);
		let singlePrefix = "";
		if (!date) {
			const single = dateLine.match(new RegExp(`^\\s*(${DATE_POINT})\\s*\\|\\s*`, "i"));
			if (!single) {
				unrecognized.push(...nonEmpty(block));
				continue;
			}
			singlePrefix = single[0];
			date = {
				startMonth: parseMonthToken(single[1]) ?? "",
				current: false,
				uncertain: true,
				matchIndex: 0
			};
		}
		const beforeText = singlePrefix ? "" : dateLine.slice(0, date.matchIndex).replace(/[|,;–—-]\s*$/, "").trim();
		const afterText = singlePrefix ? dateLine.slice(singlePrefix.length).trim() : dateLine.slice(date.matchIndex).replace(DATE_RANGE, "").replace(SINCE_DATE, "").replace(/^[|,;–—-]\s*/, "").trim();
		const before = [...nonEmpty(block.slice(0, dateIndex)), ...splitLineParts(beforeText)];
		const afterParts = afterText ? splitLineParts(afterText) : [];
		let after = [...afterParts.slice(2), ...nonEmpty(block.slice(dateIndex + 1))];
		const headerText = [...nonEmpty(block.slice(0, dateIndex + 1)), ...afterParts.slice(0, 2)].join(" ");
		if (NON_EMPLOYMENT_RE.test(headerText) && !before.some(companyLike)) {
			uncertain.add("experience");
			unrecognized.push(...nonEmpty(block));
			continue;
		}
		let employer = "";
		let position = "";
		if (!before.length && afterParts.length) {
			if (afterParts.length >= 2) {
				const pair = classifyExperiencePair(afterParts[0], afterParts[1]);
				employer = pair.employer;
				position = pair.position;
				if (pair.uncertain) uncertain.add("experience");
				after = [...afterParts.slice(2), ...nonEmpty(block.slice(dateIndex + 1))];
			} else {
				position = afterParts[0];
				employer = "";
				after = nonEmpty(block.slice(dateIndex + 1));
				uncertain.add("experience");
			}
		} else if (before.length === 1) {
			if (companyLike(before[0])) employer = before[0];
			else if (roleLike(before[0])) position = before[0];
			else {
				employer = before[0];
				uncertain.add("experience");
			}
		} else if (before.length >= 2) {
			const pair = classifyExperiencePair(before[0], before[1]);
			employer = pair.employer;
			position = pair.position;
			if (pair.uncertain) uncertain.add("experience");
		}
		if (!employer && /self[- ]employed|freelance/i.test(position)) employer = /freelance/i.test(position) ? "Freelance" : "Self-Employed";
		if (!employer || !position) {
			uncertain.add("experience");
			unrecognized.push(...nonEmpty(block));
			continue;
		}
		if (date.uncertain) uncertain.add("experience");
		const entry = createExperienceEntry();
		entries.push({
			...entry,
			employer,
			position,
			startMonth: date.startMonth,
			...date.endMonth ? { endMonth: date.endMonth } : {},
			current: date.current,
			...after.length ? { description: after.join("\n") } : {}
		});
	}
	return entries;
}
function mapExperienceSection(section, uncertain, unrecognized, reasonHints) {
	const entries = [];
	const timeline = [];
	const byItem = /* @__PURE__ */ new Map();
	const timelineItems = section.timeline ?? [];
	if (!timelineItems.length) {
		const local = [];
		const parsed = parseExperience(mergeWrappedLines(section.blocks.map((block) => block.text)), uncertain, local);
		unrecognized.push(...local);
		entries.push(...parsed);
		return {
			entries,
			timeline
		};
	}
	for (const item of timelineItems) {
		const isProject = item.kind === "project";
		const parent = item.parentId ? byItem.get(item.parentId) : void 0;
		if (isProject && parent?.included && parent.entryIndex !== void 0) {
			const entry = entries[parent.entryIndex];
			if (entry) {
				entry.description = [entry.description, item.lines.join("\n")].filter(Boolean).join("\n");
				const mapping = {
					itemId: item.id,
					kind: item.kind,
					parentId: item.parentId,
					page: item.page,
					dateText: item.dateText,
					entryIndex: parent.entryIndex,
					included: true
				};
				timeline.push(mapping);
				byItem.set(item.id, mapping);
				continue;
			}
		}
		if (isProject || item.kind === "training" || item.kind === "qualification") {
			const reason = item.kind === "training" ? "training" : item.kind === "qualification" ? "incomplete-education" : "project-reference";
			unrecognized.push(...item.lines);
			for (const line of item.lines) reasonHints?.set(line, reason);
			const mapping = {
				itemId: item.id,
				kind: item.kind,
				...item.parentId ? { parentId: item.parentId } : {},
				page: item.page,
				dateText: item.dateText,
				included: false,
				reason
			};
			timeline.push(mapping);
			byItem.set(item.id, mapping);
			continue;
		}
		const local = [];
		const parsed = parseExperience([...item.lines, ""], uncertain, local);
		if (parsed.length) {
			const entryIndex = entries.length;
			entries.push(...parsed);
			const mapping = {
				itemId: item.id,
				kind: item.kind,
				...item.parentId ? { parentId: item.parentId } : {},
				page: item.page,
				dateText: item.dateText,
				entryIndex,
				included: true
			};
			timeline.push(mapping);
			byItem.set(item.id, mapping);
		} else {
			const failed = local.length ? local : item.lines;
			unrecognized.push(...failed);
			for (const line of failed) reasonHints?.set(line, "incomplete-experience");
			const mapping = {
				itemId: item.id,
				kind: item.kind,
				...item.parentId ? { parentId: item.parentId } : {},
				page: item.page,
				dateText: item.dateText,
				included: false,
				reason: "incomplete-experience"
			};
			timeline.push(mapping);
			byItem.set(item.id, mapping);
		}
	}
	return {
		entries,
		timeline
	};
}
function educationInstitutionLike(value) {
	return companyLike(value) || /\b(universität|universitaet|university|hochschule|college|school|akademie|institut|institute|fachhochschule|fachschule|berufsschule|vocational school)\b/i.test(value);
}
function buildEducationEntry(candidateLines, date, uncertain, unrecognized) {
	const lines = nonEmpty(candidateLines);
	if (!lines.length) return null;
	if (/^(professional development|certifications?|certificates?|further education|weiterbildung|fortbildung)\b/i.test(lines[0])) {
		unrecognized.push(...lines);
		uncertain.add("education");
		return null;
	}
	const degreeLine = lines.find((line) => degreeLike(line));
	const institutionLine = lines.find((line) => educationInstitutionLike(line));
	let institution = institutionLine ?? "";
	let degree = degreeLine ?? "";
	const used = new Set([degreeLine, institutionLine].filter((line) => Boolean(line)));
	const remaining = lines.filter((line) => !used.has(line));
	if (degreeLine && remaining.length) {
		const fieldLine = remaining.find((line) => line.split(/\s+/).length <= 6 && !/[.!?]$/.test(line) && !/^\d/.test(line) && !educationInstitutionLike(line));
		if (fieldLine) {
			degree = `${fieldLine} – ${degree}`;
			used.add(fieldLine);
		}
	}
	if (!institution && !degree) {
		institution = lines[0];
		used.add(lines[0]);
	}
	const description = lines.filter((line) => !used.has(line));
	if (!institution || !degree || !date || date.uncertain) uncertain.add("education");
	return {
		...createEducationEntry(),
		institution,
		degree,
		startMonth: date?.startMonth ?? "",
		...date?.endMonth ? { endMonth: date.endMonth } : {},
		current: date?.current ?? false,
		...description.length ? { description: description.join("\n") } : {}
	};
}
function assignEducationInstitutions(lines, degreeLines) {
	const degreeIndices = [];
	let cursor = 0;
	for (const degree of degreeLines) {
		let index = lines.indexOf(degree, cursor);
		if (index < 0) index = lines.indexOf(degree);
		degreeIndices.push(index);
		if (index >= 0) cursor = index + 1;
	}
	const institutionIndices = lines.map((line, index) => educationInstitutionLike(line) ? index : -1).filter((index) => index >= 0);
	const assignments = degreeLines.map(() => ({
		institution: "",
		uncertain: true
	}));
	if (!institutionIndices.length) return assignments;
	if (institutionIndices.length === 1) {
		const institutionIndex = institutionIndices[0];
		const institution = lines[institutionIndex];
		if (institutionIndex < Math.min(...degreeIndices.filter((index) => index >= 0))) return degreeLines.map(() => ({
			institution,
			uncertain: false
		}));
		let best = -1;
		let bestScore = Number.POSITIVE_INFINITY;
		degreeIndices.forEach((degreeIndex, index) => {
			if (degreeIndex < 0) return;
			const distance = Math.abs(degreeIndex - institutionIndex);
			const tiePreference = degreeIndex < institutionIndex ? 0 : 1;
			const score = distance * 2 + tiePreference;
			if (score < bestScore) {
				bestScore = score;
				best = index;
			}
		});
		if (best >= 0) assignments[best] = {
			institution,
			uncertain: false
		};
		return assignments;
	}
	const bestByDegree = /* @__PURE__ */ new Map();
	for (const institutionIndex of institutionIndices) {
		const institution = lines[institutionIndex];
		let best = -1;
		let bestScore = Number.POSITIVE_INFINITY;
		degreeIndices.forEach((degreeIndex, index) => {
			if (degreeIndex < 0 || bestByDegree.has(index)) return;
			const distance = Math.abs(degreeIndex - institutionIndex);
			const tiePreference = degreeIndex < institutionIndex ? 0 : 1;
			const score = distance * 2 + tiePreference;
			if (score < bestScore) {
				bestScore = score;
				best = index;
			}
		});
		if (best < 0) continue;
		const distance = Math.abs(degreeIndices[best] - institutionIndex);
		bestByDegree.set(best, {
			institution,
			distance
		});
	}
	bestByDegree.forEach((value, index) => {
		assignments[index] = {
			institution: value.institution,
			uncertain: false
		};
	});
	return assignments;
}
function educationDescriptionLines(lines, start, end) {
	return lines.slice(start + 1, end).filter((line) => !degreeLike(line) && !educationInstitutionLike(line));
}
function educationDateDegreeIndex(block, dateIndex, degreeLines) {
	const distances = degreeLines.map((degree) => {
		const index = block.indexOf(degree);
		return index >= 0 ? Math.abs(index - dateIndex) : Number.POSITIVE_INFINITY;
	});
	const minimum = Math.min(...distances);
	if (!Number.isFinite(minimum)) return null;
	const winners = distances.map((distance, index) => distance === minimum ? index : -1).filter((index) => index >= 0);
	return winners.length === 1 ? winners[0] : null;
}
function parseEducation(lines, uncertain, unrecognized) {
	const entries = [];
	for (const block of splitBlocks(lines)) {
		const dateIndex = block.findIndex((line) => parseDateRange(line) !== null);
		if (dateIndex < 0) {
			const lines = nonEmpty(block);
			const degreeLines = lines.filter((line) => degreeLike(line));
			if (degreeLines.length > 1) {
				const assignments = assignEducationInstitutions(lines, degreeLines);
				degreeLines.forEach((degreeLine, index) => {
					const start = lines.indexOf(degreeLine);
					const nextDegree = degreeLines[index + 1];
					const end = nextDegree ? lines.indexOf(nextDegree) : lines.length;
					const description = educationDescriptionLines(lines, start, end);
					const assignment = assignments[index];
					if (assignment.uncertain) uncertain.add("education");
					const entry = createEducationEntry();
					entries.push({
						...entry,
						institution: assignment.institution,
						degree: degreeLine,
						startMonth: "",
						current: false,
						...description.length ? { description: description.join("\n") } : {}
					});
				});
				continue;
			}
			const entry = buildEducationEntry(block, null, uncertain, unrecognized);
			if (entry) entries.push(entry);
			continue;
		}
		const date = parseDateRange(block[dateIndex]);
		if (!date) continue;
		const dateLine = block[dateIndex];
		const beforeText = dateLine.slice(0, date.matchIndex).replace(/[|,;–—-]\s*$/, "").trim();
		const afterText = dateLine.slice(date.matchIndex).replace(DATE_RANGE, "").replace(SINCE_DATE, "").replace(/^[|,;–—-]\s*/, "").trim();
		const before = [...nonEmpty(block.slice(0, dateIndex)), ...splitLineParts(beforeText)];
		const after = [...afterText ? splitLineParts(afterText) : [], ...nonEmpty(block.slice(dateIndex + 1))];
		const candidates = [...before, ...after];
		const degreeLines = nonEmpty(candidates).filter((line) => degreeLike(line));
		if (degreeLines.length > 1) {
			const allLines = nonEmpty(candidates);
			const assignments = assignEducationInstitutions(allLines, degreeLines);
			const dateDegreeIndex = educationDateDegreeIndex(block, dateIndex, degreeLines);
			if (dateDegreeIndex === null) uncertain.add("education");
			degreeLines.forEach((degreeLine, index) => {
				const start = allLines.indexOf(degreeLine);
				const nextDegree = degreeLines[index + 1];
				const end = nextDegree ? allLines.indexOf(nextDegree) : allLines.length;
				const description = educationDescriptionLines(allLines, start, end);
				const assignment = assignments[index];
				const receivesDate = dateDegreeIndex === index;
				if (assignment.uncertain) uncertain.add("education");
				const entry = createEducationEntry();
				entries.push({
					...entry,
					institution: assignment.institution,
					degree: degreeLine,
					startMonth: receivesDate ? date.startMonth : "",
					...receivesDate && date.endMonth ? { endMonth: date.endMonth } : {},
					current: receivesDate ? date.current : false,
					...description.length ? { description: description.join("\n") } : {}
				});
			});
			continue;
		}
		const entry = buildEducationEntry(candidates, date, uncertain, unrecognized);
		if (entry) entries.push(entry);
	}
	return entries;
}
const KNOWN_TECH_RE = /\b(?:AWS|Lambda|SQS|Dynamo(?:DB)|IAM|Cognito|CloudWatch|CloudTrail|Terraform|Docker|Kubernetes|Serverless|API Gateway|React|TypeScript|JavaScript|Java|Spring Boot|Node\.js|PostgreSQL|MySQL|Oracle|Vercel|OpenRouter|EdenAI|LLM|LLMs|GitHub Actions|Git|Jenkins|Vite|PHP|HTML|CSS|Microservices|REST APIs)\b/gi;
function knownTechnologiesInLine(line) {
	const matches = line.match(KNOWN_TECH_RE) ?? [];
	const unique = [];
	const seen = /* @__PURE__ */ new Set();
	for (const match of matches) {
		const key = match.toLocaleLowerCase("de");
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(match);
	}
	return unique.length >= 2 ? unique : [];
}
function splitProjectName(value) {
	const match = value.match(/^((?:19|20)\d{2}(?:\s*[-–—]\s*(?:19|20)\d{2})?)\s*(?:\||[-–—])\s*(.+)$/);
	if (!match) return { name: value.trim() };
	return {
		name: match[2].trim(),
		period: match[1].trim()
	};
}
function technologiesInLine(line) {
	const match = line.match(/\b(?:technologien|technologies|tech(?: stack)?|stack|tools|mit|using|based on|auf basis von)\b\s*[:\-]?\s*(.+)$/i);
	if (!match) return [];
	return match[1].split(/\s*(?:,|;|\||\/|\bund\b|\band\b)\s*/i).map((entry) => entry.trim().replace(/[.]+$/, "")).filter(isSkillCandidate);
}
function parseProjects(lines, uncertain, unrecognized) {
	const entries = [];
	for (const block of splitProjectBlocks(lines)) {
		const cleaned = nonEmpty(block);
		if (!cleaned.length) continue;
		const parsedName = splitProjectName(cleaned[0]);
		if (!parsedName.name) continue;
		let descriptionLines = cleaned.slice(1);
		const technologies = [];
		const seenTechnologies = /* @__PURE__ */ new Set();
		if (parsedName.period) descriptionLines = [`Zeitraum: ${parsedName.period}`, ...descriptionLines];
		descriptionLines = descriptionLines.filter((line) => {
			const tech = line.match(/^(?:technologien|technologies|tech(?: stack)?|stack|tools)\s*[:\-]\s*(.+)$/i);
			if (tech) {
				for (const item of tech[1].split(/[,;|]/).map((entry) => entry.trim().replace(/[.]+$/, ""))) {
					if (!isSkillCandidate(item)) continue;
					const key = item.toLocaleLowerCase("de");
					if (seenTechnologies.has(key)) continue;
					seenTechnologies.add(key);
					technologies.push(item);
				}
				return false;
			}
			if (linksInLine(line).length > 0 && line.replace(LINK_RE, "").replace(/[·|:]/g, "").trim().length < 20) return false;
			for (const candidate of [...technologiesInLine(line), ...knownTechnologiesInLine(line)]) {
				const key = candidate.toLocaleLowerCase("de");
				if (seenTechnologies.has(key)) continue;
				seenTechnologies.add(key);
				technologies.push(candidate);
			}
			return true;
		});
		if (!descriptionLines.length && !technologies.length) uncertain.add("projects");
		const entry = createProjectEntry();
		entries.push({
			...entry,
			name: parsedName.name,
			...descriptionLines.length ? { description: descriptionLines.join("\n") } : {},
			technologies
		});
	}
	if (!entries.length && lines.length) unrecognized.push(...nonEmpty(lines));
	return entries;
}
const CERTIFICATION_GOAL_RE = /\b(?:zertifizierungsziel|zertifizierungsstatus|target certification|planned certification|in preparation|preparing for|planned|in progress|pursuing|geplant|in vorbereitung|angestrebt|not yet acquired|noch nicht erworben)\b/i;
function parseCertificates(lines, uncertain, unrecognized) {
	const entries = [];
	for (const line of nonEmpty(lines)) {
		if (CERTIFICATION_GOAL_RE.test(line)) {
			uncertain.add("certificates");
			unrecognized.push(line);
			continue;
		}
		const parts = line.split(/\s*(?:\||;|·)\s*/).map(cleanLine).filter(Boolean);
		if (!parts.length) continue;
		const date = parseDateRange(line);
		const singleDate = line.match(new RegExp(`(${DATE_POINT})`, "i"));
		const singleMonth = singleDate ? parseMonthToken(singleDate[1]) : null;
		const name = parts[0];
		if (!name) continue;
		const issuer = parts.find((part, index) => index > 0 && !parseDateRange(part) && part !== parts[0]);
		if (!issuer || !date && !singleMonth || date?.uncertain || singleMonth === "") uncertain.add("certificates");
		const entry = createCertificateEntry();
		entries.push({
			...entry,
			name,
			...issuer ? { issuer } : {},
			...date?.startMonth ? { date: date.startMonth } : singleMonth ? { date: singleMonth } : {}
		});
	}
	return entries;
}
const LANGUAGE_LEVELS = [
	[/muttersprache|native|mother tongue/i, "native"],
	[/fließend|fluent|verhandlungssicher/i, "fluent"],
	[/beruflich|professional|business|gute kenntnisse/i, "professional"],
	[/konversation|conversational|mittelstufe|intermediate/i, "conversational"],
	[/grundkenntnisse|basic|anfänger|beginner|a1|a2/i, "basic"]
];
function parseLanguages(lines, uncertain, unrecognized) {
	const entries = [];
	for (const line of nonEmpty(lines)) {
		const segments = line.split(/\s*\|\s*/).map(cleanLine).filter(Boolean);
		for (const segment of segments) {
			const match = segment.match(/^([^:–—()\-]+?)\s*(?:[:–—(]|\s-\s)\s*(.+?)\)?$/);
			if (!match) {
				unrecognized.push(segment);
				uncertain.add("languages");
				continue;
			}
			const language = cleanLine(match[1]);
			const levelText = match[2];
			const level = LANGUAGE_LEVELS.find(([pattern]) => pattern.test(levelText))?.[1];
			if (!language || !level) {
				unrecognized.push(segment);
				uncertain.add("languages");
				continue;
			}
			const entry = createLanguageEntry();
			entries.push({
				...entry,
				language,
				level
			});
		}
	}
	return entries;
}
function parseLinks(lines, unrecognized) {
	const entries = [];
	const seen = /* @__PURE__ */ new Set();
	for (const line of nonEmpty(lines)) {
		const urls = linksInLine(line);
		if (!urls.length) {
			unrecognized.push(line);
			continue;
		}
		for (const url of urls) {
			const entry = linkEntry(url);
			if (seen.has(entry.url)) continue;
			seen.add(entry.url);
			entries.push(entry);
		}
	}
	return entries;
}
function collectLinks(lines) {
	const entries = [];
	const seen = /* @__PURE__ */ new Set();
	for (const line of nonEmpty(lines)) for (const url of linksInLine(line)) {
		const entry = linkEntry(url);
		if (seen.has(entry.url)) continue;
		seen.add(entry.url);
		entries.push(entry);
	}
	return entries;
}
function parsePersonal(lines) {
	const personal = {};
	let uncertain = false;
	const labeled = {
		name: "fullName",
		"vollständiger name": "fullName",
		"full name": "fullName",
		email: "email",
		"e-mail": "email",
		"e-mail-adresse": "email",
		mail: "email",
		telefon: "phone",
		telefonnummer: "phone",
		phone: "phone",
		mobil: "phone",
		mobiltelefon: "phone",
		handynummer: "phone",
		mobile: "phone",
		tel: "phone",
		ort: "location",
		wohnort: "location",
		stadt: "location",
		location: "location",
		adresse: "location",
		address: "location",
		plz: "location",
		postal: "location"
	};
	for (const rawLine of lines) {
		const line = cleanLine(rawLine);
		if (!line) continue;
		const label = line.match(/^([^:]{2,30})\s*:\s*(.+)$/);
		if (label) {
			const key = labeled[label[1].trim().toLocaleLowerCase("de")];
			if (key) {
				personal[key] = label[2].trim();
				continue;
			}
		}
		const email = line.match(EMAIL_RE);
		if (email && !personal.email) personal.email = email[0];
		const phone = line.match(PHONE_RE);
		if (phone && !personal.phone) personal.phone = phone[0].trim();
		if (!personal.fullName && !email && !LINK_RE.test(line) && !PHONE_RE.test(line) && !line.includes(":")) {
			const candidate = line.replace(/^(herr|frau|mr|mrs|ms)\.?\s+/i, "").trim();
			if (candidate.length >= 2 && candidate.length <= 80 && candidate.split(/\s+/).length >= 2 && candidate.split(/\s+/).length <= 4 && !/[.!?]$/.test(candidate) && !titleLike(candidate) && !companyLike(candidate) && !/\b(professional|profile|profil|summary|experience|erfahrung|curriculum)\b/i.test(candidate) && /[a-zäöüß]/i.test(candidate)) personal.fullName = candidate === candidate.toLocaleUpperCase("de") ? candidate.toLocaleLowerCase("de").replace(/(^|\s)(\p{L})/gu, (_match, space, letter) => `${space}${letter.toLocaleUpperCase("de")}`) : candidate;
		}
		const locationPart = line.split(/\s*[|•]\s*/).map((part) => part.trim()).find((part) => /,/.test(part) && !EMAIL_RE.test(part) && !PHONE_RE.test(part) && !LINK_RE.test(part) && part.length <= 100);
		if (!personal.location && locationPart) personal.location = locationPart;
		if (!personal.location && line !== personal.fullName && line.toLocaleUpperCase("de") !== personal.fullName?.toLocaleUpperCase("de") && !email && !PHONE_RE.test(line) && !LINK_RE.test(line) && !line.includes(":") && line.length <= 100 && line.split(/\s+/).length <= 5 && !/[.!?]$/.test(line) && !/^\d/.test(line) && !titleLike(line) && !companyLike(line)) personal.location = line;
	}
	if (!personal.fullName) uncertain = true;
	return {
		personal,
		uncertain,
		detected: Object.values(personal).some(Boolean)
	};
}
const SKILL_CATEGORY_PREFIX = /^(?:architecture|programming(?: languages?)?|languages?|frameworks?|libraries|tools?|platforms?|databases?|cloud|cloud\s*[&+]\s*devops|software\s*[&+]\s*architektur|software\s*[&+]\s*data|aws\s*[&+]\s*infrastruktur|web\s*[&+]\s*daten|data\s*[&+]\s*integration|ai engineering|development|infrastructure|devops|methoden|methodologies|technologien|technologies)\s*[:\-]\s*/i;
const SKILL_SENTENCE_WORDS = /\b(developed|built|implemented|responsible|worked|created|designed|managed|supported|led|maintained|entwickelt|umgesetzt|verantwortlich|betreut|erstellt|konzipiert|unterstützt|geleitet|gewartet|durchgeführt)\b/i;
const SKILL_GROUP_LABEL_RE = /^(?:architecture\s*&\s*cloud|ai engineering|technical skills|technologies|infrastructure|focus areas|data\s*&\s*integration|professional development|additional aws hands-on practice|selected professional strengths|profile note)$/i;
function isSkillCandidate(value) {
	const item = value.replace(/^[-•*–—]\s*/, "").replace(/[,;|]+$/, "").trim();
	if (item.length < 2 || item.length > 60) return false;
	if (EMAIL_RE.test(item) || LINK_RE.test(item)) return false;
	if (/\b(19|20)\d{2}\b/.test(item)) return false;
	if (/[.!?]$/.test(item) || /[.!?]\s/.test(item)) return false;
	if (item.split(/\s+/).length > 6) return false;
	if (!/[A-Z]/.test(item) && item.split(/\s+/).length > 2) return false;
	if (SKILL_SENTENCE_WORDS.test(item)) return false;
	if (/^(and|or|with|und|oder|mit|sowie)$/i.test(item)) return false;
	if (/^\d+$/.test(item)) return false;
	return /[a-zäöüß0-9]/i.test(item);
}
function skillDedupeKey(value) {
	return value.toLocaleLowerCase("de").replace(/[\s._-]+/g, "").trim();
}
function parseSkills(lines, uncertain, unrecognized) {
	const seen = /* @__PURE__ */ new Set();
	const skills = [];
	const mergedLines = [];
	for (const rawLine of lines) {
		const line = cleanLine(rawLine);
		if (!line) {
			mergedLines.push("");
			continue;
		}
		const previous = mergedLines[mergedLines.length - 1];
		if (previous && !/[.!?]$/.test(previous) && !/:$/.test(previous) && (/^[a-zäöüß]/.test(line) || /[,;\/]$/.test(previous)) && !SKILL_CATEGORY_PREFIX.test(line) && !SKILL_SENTENCE_WORDS.test(line) && !sectionFor(line)) mergedLines[mergedLines.length - 1] = `${previous} ${line}`;
		else mergedLines.push(line);
	}
	for (const line of mergedLines) {
		if (!line) continue;
		const cleaned = line.replace(SKILL_CATEGORY_PREFIX, "");
		const words = cleaned.split(/\s+/).filter(Boolean);
		if (!cleaned) continue;
		if (words.length > 8 && !/[,;|•]/.test(cleaned)) {
			unrecognized.push(line);
			uncertain.add("skills");
			continue;
		}
		const candidates = cleaned.split(/[,;|•·]|\s+\/\s+/).map((value) => value.trim()).filter(Boolean);
		for (const candidate of candidates) {
			if (SKILL_GROUP_LABEL_RE.test(candidate)) continue;
			if (!isSkillCandidate(candidate)) {
				unrecognized.push(candidate);
				uncertain.add("skills");
				continue;
			}
			const key = skillDedupeKey(candidate);
			if (!seen.has(key)) {
				seen.add(key);
				skills.push(candidate);
			}
		}
	}
	return skills;
}
function hasSectionContent(draft, section) {
	switch (section) {
		case "personal": return Object.values(draft.personal).some(Boolean);
		case "profile": return Boolean(draft.profile.headline || draft.profile.summary);
		case "experience": return draft.experience.length > 0;
		case "education": return draft.education.length > 0;
		case "skills": return draft.skills.length > 0;
		case "projects": return draft.projects.length > 0;
		case "certificates": return draft.certificates.length > 0;
		case "languages": return draft.languages.length > 0;
		case "links": return draft.links.length > 0;
		default: return false;
	}
}
const LANGUAGE_NAME_RE = /\b(?:deutsch|englisch|französisch|franzoesisch|spanisch|italienisch|portugiesisch|russisch|polnisch|türkisch|tuerkisch|niederländisch|niederlaendisch|chinesisch|japanisch|arabisch|german|english|french|spanish|italian|portuguese|russian|polish|turkish|dutch|chinese|japanese|arabic)\b/i;
const LANGUAGE_LEVEL_RE = /\b(?:muttersprache|native|fließend|fliessend|fluent|verhandlungssicher|professional|business|gute kenntnisse|konversation|conversational|intermediate|mittelstufe|grundkenntnisse|basic|anfänger|anfaenger|beginner|a1|a2|b1|b2|c1|c2)\b/i;
function isLanguageLine(line) {
	return LANGUAGE_NAME_RE.test(line) && (LANGUAGE_LEVEL_RE.test(line) || /^(?:deutsch|englisch|german|english)\b/i.test(cleanLine(line)));
}
function mergeSectionLines(section) {
	return mergeWrappedLines(section.blocks.map((block) => block.text));
}
function sectionTargets(category) {
	switch (category) {
		case "personal":
		case "profile":
		case "experience":
		case "education":
		case "skills":
		case "projects":
		case "certificates":
		case "languages":
		case "links": return [category];
		case "mixed": return ["education", "languages"];
		case "target-roles": return ["profile"];
		case "training": return ["education"];
		default: return ["manual"];
	}
}
function sectionConfidence(category, uncertain) {
	if ([
		"unknown",
		"training",
		"target-roles",
		"document-notes",
		"misc"
	].includes(category)) return "uncertain";
	if (category === "mixed" || uncertain) return "partial";
	return "confirmed";
}
function buildSectionMappings(sections) {
	return sections.map((section) => ({
		sectionId: section.id,
		category: section.category,
		heading: section.heading,
		pageStart: section.pageStart,
		pageEnd: section.pageEnd,
		targets: sectionTargets(section.category),
		confidence: sectionConfidence(section.category, section.uncertain),
		itemCount: section.blocks.length,
		notes: [...section.continued ? ["continued"] : [], ...section.uncertain ? ["review-recommended"] : []]
	}));
}
function findSourceLine(line, structure) {
	for (const section of structure.sections) if (section.blocks.some((block) => block.text === line)) return {
		page: section.blocks.find((block) => block.text === line)?.page,
		sectionId: section.id,
		sectionHeading: section.heading,
		category: section.category
	};
	for (const section of structure.sections) if (section.blocks.some((block) => block.text.includes(line) || line.includes(block.text))) return {
		page: section.blocks.find((candidate) => candidate.text.includes(line) || line.includes(candidate.text))?.page,
		sectionId: section.id,
		sectionHeading: section.heading,
		category: section.category
	};
	return {};
}
function unassignedReason(line, category, heading) {
	if (CERTIFICATION_GOAL_RE.test(line) || heading && CERTIFICATION_GOAL_RE.test(heading)) return "certification-goal";
	if (category === "training") return "training";
	if (category === "target-roles") return "target-roles";
	if (category === "document-notes") return "document-notes";
	if (category === "unknown" || category === "misc") return "unknown-section";
	if (category === "experience") return "incomplete-experience";
	if (category === "education") return "incomplete-education";
	if (category === "languages") return "incomplete-language";
	if (category === "projects") return "project-reference";
	return "ambiguous";
}
function suggestedTargetFor(reason) {
	switch (reason) {
		case "target-roles": return "profile";
		case "training":
		case "incomplete-education": return "education";
		case "incomplete-experience": return "experience";
		case "incomplete-language": return "ignore";
		case "project-reference": return "projects";
		default: return "ignore";
	}
}
function buildUnassignedDetails(lines, structure, reasonHints = /* @__PURE__ */ new Map()) {
	return lines.map((line) => {
		const source = findSourceLine(line, structure);
		const reason = reasonHints.get(line) ?? unassignedReason(line, source.category, source.sectionHeading);
		return {
			line,
			...source.page ? { page: source.page } : {},
			...source.sectionId ? { sectionId: source.sectionId } : {},
			...source.sectionHeading ? { sectionHeading: source.sectionHeading } : {},
			...source.category ? { category: source.category } : {},
			suggestedTarget: suggestedTargetFor(reason),
			reason
		};
	});
}
function parseCvBuilderImportText(raw, source) {
	const draft = createEmptyCvBuilderDraft();
	const detected = emptyDetected();
	const uncertain = emptyUncertain();
	const uncertainSet = /* @__PURE__ */ new Set();
	const unrecognized = [];
	const sections = {
		header: [],
		misc: [],
		personal: [],
		profile: [],
		experience: [],
		education: [],
		skills: [],
		projects: [],
		certificates: [],
		languages: [],
		links: []
	};
	const profileSummaryLines = [];
	const experienceEntries = [];
	const timelineMappings = [];
	const reasonHints = /* @__PURE__ */ new Map();
	const structure = detectCvDocument(source ?? documentFromText(preprocessLines(raw).join("\n")));
	for (const section of structure.sections) {
		const lines = mergeSectionLines(section);
		switch (section.category) {
			case "personal":
				sections.personal.push(...lines);
				break;
			case "profile":
				if (/summary|zusammenfassung|strengths/i.test(section.heading)) profileSummaryLines.push(...lines);
				else sections.profile.push(...lines);
				break;
			case "skills":
				sections.skills.push(...lines, "");
				break;
			case "projects":
				sections.projects.push(...lines);
				break;
			case "education":
				sections.education.push(...lines, "");
				break;
			case "certificates":
				if (CERTIFICATION_GOAL_RE.test(section.heading)) {
					uncertainSet.add("certificates");
					unrecognized.push(...lines);
					break;
				}
				sections.certificates.push(...lines);
				break;
			case "languages":
				sections.languages.push(...lines);
				break;
			case "links":
				sections.links.push(...lines);
				break;
			case "experience": {
				const mapped = mapExperienceSection(section, uncertainSet, unrecognized, reasonHints);
				experienceEntries.push(...mapped.entries);
				timelineMappings.push(...mapped.timeline);
				if (mapped.timeline.some((item) => !item.included)) uncertainSet.add("experience");
				break;
			}
			case "mixed": {
				const languageLines = lines.filter(isLanguageLine);
				const nonLanguageLines = lines.filter((line) => !isLanguageLine(line));
				sections.languages.push(...languageLines);
				sections.education.push(...nonLanguageLines, "");
				if (languageLines.length && nonLanguageLines.length) uncertainSet.add("education");
				break;
			}
			case "training":
				sections.education.push(section.heading, ...lines, "");
				uncertainSet.add("education");
				break;
			case "target-roles":
			case "document-notes":
			case "unknown":
			case "misc":
				unrecognized.push(...lines);
				if (section.category === "unknown") uncertainSet.add("profile");
				break;
			default: unrecognized.push(...lines);
		}
	}
	const ignoredHeaderNames = structure.ignored.filter((entry) => entry.reason === "page-header").map((entry) => entry.block.text.split(/\s*[•|]\s*/)[0]?.trim()).filter((value) => Boolean(value));
	const personal = parsePersonal([
		...sections.header,
		...sections.personal,
		...ignoredHeaderNames
	]);
	draft.personal = personal.personal;
	detected.personal = personal.detected;
	if (personal.uncertain && personal.detected) uncertainSet.add("personal");
	const profileLines = nonEmpty(sections.profile).map((line) => line.replace(/^(?:profil|profile|berufliches profil|professional profile|summary|zusammenfassung|über mich|ueber mich)\s*[:\-]\s*/i, "").trim()).filter(Boolean);
	const summaryLines = nonEmpty(profileSummaryLines);
	if (profileLines.length) {
		draft.profile.headline = profileLines[0];
		if (profileLines.length > 1) draft.profile.summary = profileLines.slice(1).join("\n");
	}
	if (summaryLines.length) draft.profile.summary = [draft.profile.summary, summaryLines.join("\n")].filter(Boolean).join("\n");
	if (!draft.profile.headline) {
		const role = [...sections.personal, ...ignoredHeaderNames].map(cleanLine).find((line) => titleLike(line) && !EMAIL_RE.test(line) && !PHONE_RE.test(line) && !LINK_RE.test(line) && line.length <= 120);
		if (role) draft.profile.headline = role;
	}
	detected.profile = Boolean(draft.profile.headline || draft.profile.summary);
	draft.experience = experienceEntries;
	detected.experience = draft.experience.length > 0;
	draft.education = parseEducation(sections.education, uncertainSet, unrecognized);
	detected.education = draft.education.length > 0;
	draft.skills = parseSkills(sections.skills, uncertainSet, unrecognized);
	if (draft.personal.fullName) {
		const name = draft.personal.fullName.toLocaleLowerCase("de");
		draft.skills = draft.skills.filter((skill) => skill.toLocaleLowerCase("de") !== name);
	}
	detected.skills = draft.skills.length > 0;
	if (draft.skills.length > 25) uncertainSet.add("skills");
	draft.projects = parseProjects(sections.projects, uncertainSet, unrecognized);
	detected.projects = draft.projects.length > 0;
	draft.certificates = parseCertificates(sections.certificates, uncertainSet, unrecognized);
	detected.certificates = draft.certificates.length > 0;
	draft.languages = parseLanguages(sections.languages, uncertainSet, unrecognized);
	detected.languages = draft.languages.length > 0;
	draft.links = parseLinks(sections.links, unrecognized);
	const linksOutsideSections = collectLinks(Object.values(sections).flat());
	for (const entry of linksOutsideSections) if (!draft.links.some((existing) => existing.url === entry.url)) draft.links.push(entry);
	detected.links = draft.links.length > 0;
	unrecognized.push(...nonEmpty(sections.misc));
	for (const section of uncertainSet) uncertain[section] = true;
	if (!CV_BUILDER_IMPORT_SECTIONS.some((section) => detected[section])) unrecognized.push(...nonEmpty(raw.split("\n")));
	const finalUnrecognized = [...new Set(unrecognized)];
	return {
		draft,
		detected,
		uncertain,
		unrecognized: finalUnrecognized,
		unrecognizedDetails: buildUnassignedDetails(finalUnrecognized, structure, reasonHints),
		mapping: {
			sections: buildSectionMappings(structure.sections).map((section) => section.category === "skills" && draft.skills.length > 25 ? {
				...section,
				notes: [...section.notes, "skill-candidates-review"]
			} : section),
			timeline: timelineMappings
		},
		structure
	};
}
function hasCvBuilderImportContent(result, section) {
	return hasSectionContent(result.draft, section);
}
function selectCvBuilderImportDraft(result, selected, manualAssignments = {}, options = {}) {
	const selectedSet = new Set(selected);
	const next = createEmptyCvBuilderDraft();
	if (selectedSet.has("personal")) next.personal = { ...result.draft.personal };
	if (selectedSet.has("profile")) next.profile = { ...result.draft.profile };
	if (selectedSet.has("experience")) next.experience = result.draft.experience.map((entry) => ({ ...entry }));
	if (selectedSet.has("education")) next.education = result.draft.education.map((entry) => ({ ...entry }));
	if (selectedSet.has("skills")) {
		const allowed = options.selectedSkills === void 0 ? null : new Set(options.selectedSkills);
		next.skills = result.draft.skills.filter((skill) => !allowed || allowed.has(skill));
	}
	if (selectedSet.has("projects")) next.projects = result.draft.projects.map((entry) => ({
		...entry,
		technologies: [...entry.technologies]
	}));
	if (selectedSet.has("certificates")) next.certificates = result.draft.certificates.map((entry) => ({ ...entry }));
	if (selectedSet.has("languages")) next.languages = result.draft.languages.map((entry) => ({ ...entry }));
	if (selectedSet.has("links")) next.links = result.draft.links.map((entry) => ({ ...entry }));
	for (const [rawIndex, assignment] of Object.entries(manualAssignments)) {
		const line = result.unrecognized[Number(rawIndex)];
		const decision = typeof assignment === "string" ? {
			target: assignment,
			status: assignment === "ignore" ? "ignored" : "accepted"
		} : assignment;
		const target = decision.target;
		const status = decision.status ?? (target === "ignore" ? "ignored" : "accepted");
		const text = (decision.text === void 0 ? line : decision.text).trim();
		if (!line || !text || target === "ignore" || status !== "accepted") continue;
		if (target === "profile") next.profile = {
			...next.profile,
			summary: [next.profile.summary, text].filter(Boolean).join("\n")
		};
		else if (target === "skills") {
			for (const candidate of text.split(/[,;|•]/).map((value) => value.trim()).filter(Boolean)) if (!next.skills.includes(candidate)) next.skills.push(candidate);
		} else if (target === "projects") {
			const entry = createProjectEntry();
			next.projects.push({
				...entry,
				name: text
			});
		} else if (target === "experience") {
			const entry = createExperienceEntry();
			next.experience.push({
				...entry,
				position: text,
				employer: "",
				startMonth: "",
				current: false
			});
		} else if (target === "education") {
			const entry = createEducationEntry();
			next.education.push({
				...entry,
				institution: text,
				degree: "",
				startMonth: "",
				current: false
			});
		} else if (target === "certificates") {
			const entry = createCertificateEntry();
			next.certificates.push({
				...entry,
				name: text
			});
		} else if (target === "links") {
			for (const entry of collectLinks([text])) if (!next.links.some((existing) => existing.url === entry.url)) next.links.push(entry);
		}
	}
	return next;
}
//#endregion
export { CV_BUILDER_IMPORT_SECTIONS, buildPdfDocument, hasCvBuilderImportContent, parseCvBuilderImportText, selectCvBuilderImportDraft };
