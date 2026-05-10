const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const toSectionLink = (target = "") => `#${target.replace(/^#/, "")}`;
const storageKey = "junior-portfolio-content-v15";
const defaultContent = structuredClone(window.portfolioContent);
let isEditing = false;
let editorToolbarCreated = false;
let refreshEditorToolbar = null;
let editorToolbar = null;

const normalizeUrl = (value = "") => {
  const url = String(value).trim();

  if (!url || /^(javascript|data):/i.test(url)) return "";
  if (/^(https?:|mailto:|tel:|#|\.{0,2}\/)/i.test(url)) return url;
  if (/^[^\s@:/]+@[^\s@]+\.[^\s@]+$/.test(url)) return `mailto:${url}`;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(url)) return `https://${url}`;

  return url;
};

const projectLinkTypes = ["PPT", "Demo", "GitHub"];
const projectLinkOrder = new Map(projectLinkTypes.map((label, index) => [label, index]));

const getProjectLinkType = (label = "") => {
  const normalizedLabel = String(label).trim().toLowerCase();

  if (normalizedLabel === "ppt" || normalizedLabel.includes("slide")) return "PPT";
  if (normalizedLabel === "demo" || normalizedLabel.includes("play")) return "Demo";
  if (normalizedLabel === "github" || normalizedLabel === "git hub") return "GitHub";

  return String(label || "Demo").trim();
};

const sortProjectLinks = (links = []) =>
  links
    .map((link) => ({ ...link, label: getProjectLinkType(link.label) }))
    .sort(
      (first, second) =>
        (projectLinkOrder.get(first.label) ?? 99) - (projectLinkOrder.get(second.label) ?? 99)
    );

const deepMerge = (base, override) => {
  if (Array.isArray(base)) return Array.isArray(override) ? override : base;
  if (!base || typeof base !== "object") return override ?? base;

  const keys = new Set([...Object.keys(base), ...Object.keys(override || {})]);

  return Array.from(keys).reduce((result, key) => {
    result[key] = deepMerge(base[key], override?.[key]);
    return result;
  }, {});
};

const loadContent = () => {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(defaultContent);

  try {
    return deepMerge(defaultContent, JSON.parse(saved));
  } catch {
    return structuredClone(defaultContent);
  }
};

const applyProjectLinkDefaults = (content) => {
  content.projects?.items?.forEach((project, projectIndex) => {
    project.links = sortProjectLinks(project.links || []);
    const defaultLinks = sortProjectLinks(
      defaultContent.projects?.items?.[projectIndex]?.links || []
    );

    project.links.forEach((link) => {
      const defaultLink = defaultLinks.find(
        (item) => getProjectLinkType(item.label) === getProjectLinkType(link.label)
      );

      if (!link.url && defaultLink?.url) {
        link.url = defaultLink.url;
      }
    });
  });

  return content;
};

const removeUnusedVisualContent = (content) => {
  if (content.brand) {
    delete content.brand.mark;

    if (!content.brand.name || content.brand.name === "개발자 포트폴리오") {
      content.brand.name = "김기홍 포트폴리오";
    }
  }

  if (content.profile) {
    delete content.profile.image;
    delete content.profile.avatarText;
  }

  return content;
};

let portfolioContent = removeUnusedVisualContent(applyProjectLinkDefaults(loadContent()));
portfolioContent.fontSizes ||= {};

const setByPath = (object, path, value) => {
  const keys = path.split(".");
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => current?.[key], object);

  if (target && lastKey) {
    target[lastKey] = value;
  }
};

const collectEditableContent = () => {
  document.querySelectorAll("[data-edit][contenteditable='true']").forEach((element) => {
    setByPath(portfolioContent, element.dataset.edit, element.innerText.trim());
  });

  document.querySelectorAll("[data-edit-input]").forEach((input) => {
    const path = input.dataset.editInput;
    const value = input.dataset.editInput.endsWith(".url")
      ? normalizeUrl(input.value)
      : input.value.trim();

    setByPath(portfolioContent, path, value);

    const profileLinkUrlMatch = path.match(/^profile\.links\.(\d+)\.url$/);
    if (profileLinkUrlMatch) {
      const link = portfolioContent.profile?.links?.[Number(profileLinkUrlMatch[1])];

      if (link) {
        link.value = value.replace(/^mailto:/i, "").replace(/^https?:\/\//i, "");
      }
    }
  });
};

const saveToBrowser = () => {
  localStorage.setItem(storageKey, JSON.stringify(portfolioContent));
};

const getContentFileText = () =>
  `window.portfolioContent = ${JSON.stringify(portfolioContent, null, 2)};\n`;

const clampFontScale = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 1;

  return Math.min(1.6, Math.max(0.75, Number(numericValue.toFixed(2))));
};

const getFontScale = (path) => clampFontScale(portfolioContent.fontSizes?.[path] || 1);

const getFontSizeStyle = (path) => {
  const scale = getFontScale(path);
  return scale === 1 ? "" : ` style="font-size: ${scale}em"`;
};

const editable = (path, value) =>
  `data-edit="${path}"${getFontSizeStyle(path)}${
    isEditing ? ' contenteditable="true" spellcheck="false"' : ""
  }>${escapeHtml(value)}`;

const getProjectLinkIcon = (label = "") => {
  const type = getProjectLinkType(label);

  if (type === "PPT") {
    return `
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4.5 5.75h15v9.5h-15zM12 15.25v3.5M8.5 18.75h7M8 11.75l2.3-2.3 2.1 2.1 3.1-3.3" />
      </svg>
    `;
  }

  if (type === "Demo") {
    return `
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
        <path d="m10.2 8.7 5.2 3.3-5.2 3.3V8.7Z" />
      </svg>
    `;
  }

  return `
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path class="is-filled" d="M12 2.25c-5.4 0-9.75 4.35-9.75 9.75 0 4.32 2.8 7.98 6.68 9.27.49.09.67-.21.67-.47v-1.7c-2.72.59-3.29-1.16-3.29-1.16-.44-1.13-1.08-1.43-1.08-1.43-.89-.61.07-.6.07-.6.98.07 1.5 1.01 1.5 1.01.87 1.49 2.28 1.06 2.84.81.09-.63.34-1.06.62-1.3-2.17-.25-4.45-1.09-4.45-4.83 0-1.07.38-1.94 1.01-2.62-.1-.25-.44-1.25.1-2.59 0 0 .82-.26 2.68 1 .78-.22 1.62-.33 2.45-.33.83 0 1.67.11 2.45.33 1.86-1.26 2.68-1 2.68-1 .54 1.34.2 2.34.1 2.59.63.68 1.01 1.55 1.01 2.62 0 3.75-2.29 4.58-4.47 4.82.35.3.67.9.67 1.82v2.7c0 .26.18.57.68.47A9.76 9.76 0 0 0 21.75 12c0-5.4-4.35-9.75-9.75-9.75Z" />
    </svg>
  `;
};

const renderProjectLinks = (links = [], projectIndex = 0) => {
  const normalizedLinks = sortProjectLinks(links);
  const basePath = `projects.items.${projectIndex}.links`;
  const buttons = normalizedLinks
    .map((link) => {
      const href = normalizeUrl(link.url);
      const label = getProjectLinkType(link.label);
      const icon = getProjectLinkIcon(label);

      if (href) {
        return `<a class="project-icon-button" href="${escapeHtml(
          href
        )}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(
          `${label} link`
        )}" title="${escapeHtml(label)}">${icon}</a>`;
      }

      return `<button class="project-icon-button is-disabled" type="button" aria-disabled="true" aria-label="${escapeHtml(
        `${label} link empty`
      )}" title="${escapeHtml(`${label} link empty`)}">${icon}</button>`;
    })
    .join("");

  const existingTypes = new Set(normalizedLinks.map((link) => getProjectLinkType(link.label)));
  const addButtons = projectLinkTypes
    .filter((label) => !existingTypes.has(label))
    .map(
      (label) => `
        <button
          class="project-link-add"
          type="button"
          data-project-link-action="add"
          data-project-index="${projectIndex}"
          data-link-label="${escapeHtml(label)}"
        >${escapeHtml(label)} 추가</button>
      `
    )
    .join("");

  const fields = isEditing
    ? `<div class="project-link-fields">
        ${normalizedLinks
          .map(
            (link, index) => `
              <div class="project-link-field">
                <label>
                  <span>${escapeHtml(getProjectLinkType(link.label))} URL</span>
                  <input
                    type="url"
                    data-edit-input="${basePath}.${index}.url"
                    value="${escapeHtml(link.url || "")}"
                    placeholder="https://..."
                  />
                </label>
                <button
                  class="project-link-remove"
                  type="button"
                  data-project-link-action="remove"
                  data-project-index="${projectIndex}"
                  data-link-index="${index}"
                >삭제</button>
              </div>
            `
          )
          .join("")}
        ${
          addButtons
            ? `<div class="project-link-add-row" aria-label="프로젝트 링크 추가">${addButtons}</div>`
            : ""
        }
      </div>`
    : "";

  return `<div class="project-link-buttons">${buttons}</div>${fields}`;
};

const getProfileLinkValue = (link = {}) =>
  link.value || String(link.url || "").replace(/^mailto:/i, "").replace(/^https?:\/\//i, "");

const getProfileLinkAttributes = (href = "") =>
  /^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : "";

const getProfileLinkIcon = (link = {}, href = "") => {
  const key = `${link.label || ""} ${link.url || ""}`.toLowerCase();

  if (key.includes("github") || key.includes("깃허브")) {
    return `
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 2.25c-5.4 0-9.75 4.35-9.75 9.75 0 4.32 2.8 7.98 6.68 9.27.49.09.67-.21.67-.47v-1.7c-2.72.59-3.29-1.16-3.29-1.16-.44-1.13-1.08-1.43-1.08-1.43-.89-.61.07-.6.07-.6.98.07 1.5 1.01 1.5 1.01.87 1.49 2.28 1.06 2.84.81.09-.63.34-1.06.62-1.3-2.17-.25-4.45-1.09-4.45-4.83 0-1.07.38-1.94 1.01-2.62-.1-.25-.44-1.25.1-2.59 0 0 .82-.26 2.68 1 .78-.22 1.62-.33 2.45-.33.83 0 1.67.11 2.45.33 1.86-1.26 2.68-1 2.68-1 .54 1.34.2 2.34.1 2.59.63.68 1.01 1.55 1.01 2.62 0 3.75-2.29 4.58-4.47 4.82.35.3.67.9.67 1.82v2.7c0 .26.18.57.68.47A9.76 9.76 0 0 0 21.75 12c0-5.4-4.35-9.75-9.75-9.75Z" />
      </svg>
    `;
  }

  if (
    href.startsWith("mailto:") ||
    key.includes("email") ||
    key.includes("이메일") ||
    key.includes("@")
  ) {
    return `
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4.75 5.75h14.5A2.25 2.25 0 0 1 21.5 8v8a2.25 2.25 0 0 1-2.25 2.25H4.75A2.25 2.25 0 0 1 2.5 16V8a2.25 2.25 0 0 1 2.25-2.25Zm0 1.75a.5.5 0 0 0-.5.5v.35l7.44 4.65c.19.12.43.12.62 0l7.44-4.65V8a.5.5 0 0 0-.5-.5H4.75Zm15 3.02-6.51 4.07a2.34 2.34 0 0 1-2.48 0L4.25 10.52V16c0 .28.22.5.5.5h14.5a.5.5 0 0 0 .5-.5v-5.48Z" />
      </svg>
    `;
  }

  return `
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M8.75 17.75 16.5 10m0 0H10m6.5 0v6.5M6.75 5.75h10.5c.55 0 1 .45 1 1v10.5c0 .55-.45 1-1 1H6.75c-.55 0-1-.45-1-1V6.75c0-.55.45-1 1-1Z" />
    </svg>
  `;
};

const renderProfileIconLinks = (links = [], includeEmptyLinks = false) => {
  const iconLinks = links
    .map((link) => {
      const href = normalizeUrl(link.url);
      const value = getProfileLinkValue(link);
      const icon = getProfileLinkIcon(link, href);

      if (href) {
        return `
          <a
            class="profile-icon-link"
            href="${escapeHtml(href)}"
            aria-label="${escapeHtml(`${link.label} 링크`)}"
            title="${escapeHtml(value)}"
            ${getProfileLinkAttributes(href)}
          >${icon}</a>
        `;
      }

      if (!includeEmptyLinks) return "";

      return `
        <button
          class="profile-icon-link is-disabled"
          type="button"
          aria-disabled="true"
          aria-label="${escapeHtml(`${link.label} 링크 비어 있음`)}"
          title="${escapeHtml(`${link.label} URL 비어 있음`)}"
        >${icon}</button>
      `;
    })
    .join("");

  return iconLinks
    ? `
      <div class="profile-icon-row">
        <dt class="profile-icon-label">연락 링크</dt>
        <dd class="profile-icon-list">${iconLinks}</dd>
      </div>
    `
    : "";
};

const renderProfileLinks = (links = []) => {
  if (!isEditing) {
    return renderProfileIconLinks(links);
  }

  const fields = links
    .map(
      (link, index) => `
        <div class="profile-link-field">
          <label>
            <span>${escapeHtml(link.label || "링크")} URL</span>
            <input
              type="text"
              data-edit-input="profile.links.${index}.url"
              value="${escapeHtml(link.url || "")}"
              placeholder="mailto: 또는 https://"
            />
          </label>
        </div>
      `
    )
    .join("");

  return `
    ${renderProfileIconLinks(links, true)}
    <div class="profile-link-fields" aria-label="소개 링크 URL 수정">
      ${fields}
    </div>
  `;
};

let profileLayoutFrame = 0;

const updateProfileLayoutMode = () => {
  const panel = document.querySelector(".profile-panel");
  if (!panel) return;

  panel.classList.remove("is-compact-profile");

  const links = Array.from(
    panel.querySelectorAll(".profile-stat-link, .profile-link-empty")
  );
  const shouldUseCompactLayout = links.some(
    (link) => link.scrollWidth > link.clientWidth + 1
  );

  panel.classList.toggle("is-compact-profile", shouldUseCompactLayout);
};

const scheduleProfileLayoutMode = () => {
  window.cancelAnimationFrame(profileLayoutFrame);
  profileLayoutFrame = window.requestAnimationFrame(updateProfileLayoutMode);
};

const renderPortfolio = (content) => {
  if (!content) return;

  document.title = content.meta?.title || document.title;

  const description = document.querySelector('meta[name="description"]');
  if (description && content.meta?.description) {
    description.setAttribute("content", content.meta.description);
  }

  document.querySelector(".brand-title").outerHTML = `
    <span class="brand-title" ${editable(
      "brand.name",
      content.brand?.name || "김기홍 포트폴리오"
    )}</span>
  `;

  document.querySelector(".nav-links").innerHTML = content.nav
    .map(
      (item, index) =>
        `<a href="${toSectionLink(item.target)}" ${editable(
          `nav.${index}.label`,
          item.label
        )}</a>`
    )
    .join("");

  document.querySelector(".hero-content").innerHTML = `
    <h1 ${editable("hero.title", content.hero.title)}</h1>
    <p class="hero-copy" ${editable("hero.description", content.hero.description)}</p>
  `;

  document.querySelector(".profile-panel").innerHTML = `
    <div class="profile-meta">
      <p class="profile-name" ${editable("profile.name", content.profile.name)}</p>
      <p class="profile-role" ${editable("profile.role", content.profile.role)}</p>
    </div>
    <dl id="profile-contact" class="profile-stats">
      ${content.profile.stats
        .map(
          (item) => `
            <div>
              <dt>${escapeHtml(item.label)}</dt>
              <dd ${editable(
                `profile.stats.${content.profile.stats.indexOf(item)}.value`,
                item.value
              )}</dd>
            </div>
          `
        )
        .join("")}
      ${renderProfileLinks(content.profile.links)}
    </dl>
  `;

  document.querySelector("#skills").innerHTML = `
    <div class="section-heading">
      <h2 ${editable("skills.title", content.skills.title)}</h2>
    </div>
    <div class="section-body skill-grid">
      ${content.skills.items
        .map(
          (skill, index) => `
            <article class="skill-card">
              <h3 ${editable(`skills.items.${index}.title`, skill.title)}</h3>
              <p ${editable(`skills.items.${index}.description`, skill.description)}</p>
            </article>
          `
        )
        .join("")}
    </div>
  `;

  document.querySelector("#projects").innerHTML = `
    <div class="section-heading">
      <h2 ${editable("projects.title", content.projects.title)}</h2>
    </div>
    <div class="section-body project-list">
      ${content.projects.items
        .map(
          (project, projectIndex) => `
            <article class="project-card featured">
              <div class="project-topline">
                <span class="project-type" ${editable(
                  `projects.items.${projectIndex}.type`,
                  project.type
                )}</span>
                <span class="project-period" ${editable(
                  `projects.items.${projectIndex}.period`,
                  project.period
                )}</span>
              </div>
              <h3 ${editable(`projects.items.${projectIndex}.title`, project.title)}</h3>
              <p class="project-summary" ${editable(
                `projects.items.${projectIndex}.summary`,
                project.summary
              )}</p>
              <div class="project-detail-grid">
                ${project.details
                  .map(
                    (detail, detailIndex) => `
                      <div>
                        <h4 ${editable(
                          `projects.items.${projectIndex}.details.${detailIndex}.label`,
                          detail.label
                        )}</h4>
                        <p ${editable(
                          `projects.items.${projectIndex}.details.${detailIndex}.value`,
                          detail.value
                        )}</p>
                      </div>
                    `
                  )
                  .join("")}
              </div>
              <div class="project-links">
                ${renderProjectLinks(project.links, projectIndex)}
              </div>
            </article>
          `
        )
        .join("")}
    </div>
  `;

  document.querySelector("#experience").innerHTML = `
    <div class="section-heading">
      <h2 ${editable("growth.title", content.growth.title)}</h2>
    </div>
    <ol class="section-body timeline">
      ${content.growth.timeline
        .map(
          (item, index) => `
            <li>
              <span ${editable(`growth.timeline.${index}.year`, item.year)}</span>
              <div>
                <h3 ${editable(`growth.timeline.${index}.title`, item.title)}</h3>
                <p ${editable(`growth.timeline.${index}.description`, item.description)}</p>
              </div>
            </li>
          `
        )
        .join("")}
    </ol>
    <div class="section-body growth-focus">
      ${content.growth.focus
        .map(
          (item, index) => `
            <article>
              <h3 ${editable(`growth.focus.${index}.title`, item.title)}</h3>
              <p ${editable(`growth.focus.${index}.description`, item.description)}</p>
            </article>
          `
        )
        .join("")}
    </div>
  `;

  scheduleProfileLayoutMode();
};

renderPortfolio(portfolioContent);

const topButton = document.querySelector(".top-button");
const scrollProgress = document.querySelector(".scroll-progress");
const navShell = document.querySelector(".nav-shell");
const mobileNavToggle = document.querySelector(".mobile-nav-toggle");
const mobileNavLabel = document.querySelector(".mobile-nav-label");
let navLinks = [];
let sections = [];
let lastTopButtonScrollY = window.scrollY;
const mobileTopButtonQuery = window.matchMedia("(max-width: 620px)");

const refreshNavigationTargets = () => {
  navLinks = Array.from(document.querySelectorAll(".nav-links a"));
  sections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
};

const updateTopButton = () => {
  const currentScrollY = window.scrollY;
  const scrollDelta = currentScrollY - lastTopButtonScrollY;

  if (mobileTopButtonQuery.matches) {
    if (currentScrollY <= 80 || scrollDelta > 4) {
      topButton.classList.remove("is-visible");
    } else if (currentScrollY > 240 && scrollDelta < -6) {
      topButton.classList.add("is-visible");
    }
  } else {
    topButton.classList.toggle("is-visible", currentScrollY > 520);
  }

  lastTopButtonScrollY = currentScrollY;
};

const updateScrollProgress = () => {
  if (!scrollProgress) return;

  const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollableHeight > 0 ? window.scrollY / scrollableHeight : 0;
  scrollProgress.style.transform = `scaleX(${Math.min(Math.max(progress, 0), 1)})`;
};

const setActiveNavLink = (activeHref) => {
  navLinks.forEach((link) => {
    const isActive = link.getAttribute("href") === activeHref;
    link.classList.toggle("is-active", isActive);

    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  const activeLink = navLinks.find((link) => link.getAttribute("href") === activeHref);
  if (mobileNavLabel && activeLink) {
    mobileNavLabel.textContent = activeLink.textContent.trim();
  }
};

const updateActiveNav = () => {
  const activePoint = Math.min(window.innerHeight * 0.42, 360);
  const isAtBottom =
    window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;

  if (isAtBottom) {
    const lastSection = sections[sections.length - 1];

    setActiveNavLink(`#${lastSection.id}`);
    return;
  }

  const currentSection = sections.reduce((current, section) => {
    const sectionTop = section.getBoundingClientRect().top;
    return sectionTop <= activePoint ? section : current;
  }, sections[0]);

  setActiveNavLink(`#${currentSection.id}`);
};

const setMobileNavOpen = (isOpen) => {
  if (!navShell || !mobileNavToggle) return;

  navShell.classList.toggle("is-open", isOpen);
  mobileNavToggle.setAttribute("aria-expanded", String(isOpen));
};

const closeMobileNav = () => {
  setMobileNavOpen(false);
};

const bindNavigationEvents = () => {
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      if (isEditing) return;

      navLinks.forEach((item) => item.classList.remove("is-active"));
      link.classList.add("is-active");
      if (mobileNavLabel) {
        mobileNavLabel.textContent = link.textContent.trim();
      }
      closeMobileNav();
    });
  });
};

const bindMobileNavigation = () => {
  if (!navShell || !mobileNavToggle) return;

  mobileNavToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    setMobileNavOpen(!navShell.classList.contains("is-open"));
  });

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target && navShell.contains(target)) return;

    closeMobileNav();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMobileNav();
    }
  });
};

const createEditorToolbar = ({ startEditing = false } = {}) => {
  if (editorToolbarCreated) {
    if (startEditing) {
      isEditing = true;
      if (editorToolbar) editorToolbar.hidden = false;
      refreshEditorToolbar?.();
    }

    return;
  }

  editorToolbarCreated = true;
  const toolbar = document.createElement("div");
  editorToolbar = toolbar;
  toolbar.className = "editor-toolbar";
  toolbar.innerHTML = `
    <button class="editor-toggle" type="button">편집</button>
    <button class="editor-save" type="button" hidden>저장</button>
    <button class="editor-file-save" type="button" hidden>파일 저장</button>
    <button class="editor-reset" type="button" hidden>초기화</button>
    <div class="editor-font-tools" hidden>
      <button class="editor-font-decrease" type="button" aria-label="글자 작게">A-</button>
      <span class="editor-font-status" aria-live="polite">100%</span>
      <button class="editor-font-increase" type="button" aria-label="글자 크게">A+</button>
      <button class="editor-font-reset" type="button">기본</button>
    </div>
    <span class="editor-status" aria-live="polite"></span>
  `;
  document.body.append(toolbar);

  const toggleButton = toolbar.querySelector(".editor-toggle");
  const saveButton = toolbar.querySelector(".editor-save");
  const fileSaveButton = toolbar.querySelector(".editor-file-save");
  const resetButton = toolbar.querySelector(".editor-reset");
  const fontTools = toolbar.querySelector(".editor-font-tools");
  const fontDecreaseButton = toolbar.querySelector(".editor-font-decrease");
  const fontIncreaseButton = toolbar.querySelector(".editor-font-increase");
  const fontResetButton = toolbar.querySelector(".editor-font-reset");
  const fontStatus = toolbar.querySelector(".editor-font-status");
  const status = toolbar.querySelector(".editor-status");

  let statusTimer;
  let activeEditPath = "";
  let activeEditElement = null;

  const showStatus = (message) => {
    status.textContent = message;
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
      status.textContent = "";
    }, 1800);
  };

  const syncFontTools = () => {
    const hasActiveText = Boolean(isEditing && activeEditPath);
    fontTools.hidden = !hasActiveText;

    if (hasActiveText) {
      fontStatus.textContent = `${Math.round(getFontScale(activeEditPath) * 100)}%`;
    }
  };

  const syncToolbar = () => {
    document.body.classList.toggle("is-editing", isEditing);
    toggleButton.textContent = isEditing ? "닫기" : "편집";
    saveButton.hidden = !isEditing;
    fileSaveButton.hidden = !isEditing;
    resetButton.hidden = !isEditing;
    syncFontTools();
  };

  const setActiveEditable = (element) => {
    document
      .querySelectorAll("[data-edit][contenteditable='true'].is-active-edit")
      .forEach((item) => item.classList.remove("is-active-edit"));

    activeEditElement = element;
    activeEditPath = element?.dataset.edit || "";

    if (element) {
      element.classList.add("is-active-edit");
    }

    syncFontTools();
  };

  const applyActiveFontScale = (scale) => {
    if (!activeEditPath) {
      showStatus("텍스트를 선택해주세요");
      return;
    }

    collectEditableContent();
    portfolioContent.fontSizes ||= {};

    const nextScale = clampFontScale(scale);
    if (nextScale === 1) {
      delete portfolioContent.fontSizes[activeEditPath];
      activeEditElement?.removeAttribute("style");
    } else {
      portfolioContent.fontSizes[activeEditPath] = nextScale;
      if (activeEditElement) {
        activeEditElement.style.fontSize = `${nextScale}em`;
      }
    }

    syncFontTools();
  };

  const bindTextSizeEditor = () => {
    document
      .querySelectorAll("[data-edit][contenteditable='true']")
      .forEach((element) => {
        element.addEventListener("focus", () => setActiveEditable(element));
        element.addEventListener("click", () => setActiveEditable(element));
      });
  };

  const bindProjectLinkEditor = () => {
    document.querySelectorAll("[data-project-link-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const projectIndex = Number(button.dataset.projectIndex);
        const project = portfolioContent.projects?.items?.[projectIndex];
        if (!project) return;

        collectEditableContent();
        project.links = sortProjectLinks(project.links || []);

        if (button.dataset.projectLinkAction === "add") {
          const label = getProjectLinkType(button.dataset.linkLabel);
          const hasLink = project.links.some(
            (link) => getProjectLinkType(link.label) === label
          );

          if (!hasLink) {
            project.links.push({ label, url: "" });
            project.links = sortProjectLinks(project.links);
            showStatus(`${label} 버튼 추가됨`);
          }
        }

        if (button.dataset.projectLinkAction === "remove") {
          const linkIndex = Number(button.dataset.linkIndex);

          if (Number.isInteger(linkIndex) && project.links[linkIndex]) {
            const label = getProjectLinkType(project.links[linkIndex].label);
            project.links.splice(linkIndex, 1);
            showStatus(`${label} 버튼 삭제됨`);
          }
        }

        rerender();
      });
    });
  };

  const rerender = () => {
    renderPortfolio(portfolioContent);
    refreshNavigationTargets();
    bindNavigationEvents();
    bindTextSizeEditor();
    bindProjectLinkEditor();
    updateActiveNav();
    syncToolbar();
  };

  refreshEditorToolbar = rerender;

  const closeEditor = () => {
    isEditing = false;
    renderPortfolio(portfolioContent);
    refreshNavigationTargets();
    bindNavigationEvents();
    updateActiveNav();
    document.body.classList.remove("is-editing");
    editorToolbarCreated = false;
    refreshEditorToolbar = null;
    editorToolbar = null;
    toolbar.remove();
  };

  toggleButton.addEventListener("click", () => {
    if (isEditing) {
      collectEditableContent();
      saveToBrowser();
      closeEditor();
      return;
    }

    isEditing = true;
    rerender();
  });

  saveButton.addEventListener("click", () => {
    collectEditableContent();
    saveToBrowser();
    showStatus("저장됨");
    rerender();
  });

  fontDecreaseButton.addEventListener("click", () => {
    applyActiveFontScale(getFontScale(activeEditPath) - 0.05);
  });

  fontIncreaseButton.addEventListener("click", () => {
    applyActiveFontScale(getFontScale(activeEditPath) + 0.05);
  });

  fontResetButton.addEventListener("click", () => {
    applyActiveFontScale(1);
  });

  fileSaveButton.addEventListener("click", async () => {
    collectEditableContent();
    saveToBrowser();

    const fileText = getContentFileText();

    if ("showSaveFilePicker" in window) {
      try {
        const handle = await window.showSaveFilePicker({
          id: "portfolio-content-file",
          suggestedName: "content.js",
          startIn: "documents",
          types: [
            {
              description: "JavaScript file",
              accept: { "text/javascript": [".js"] },
            },
          ],
        });
        const writable = await handle.createWritable();
        await writable.write(fileText);
        await writable.close();
        showStatus("파일 저장됨");
      } catch (error) {
        if (error?.name !== "AbortError") {
          window.alert("파일 저장에 실패했습니다. 브라우저 권한 또는 파일 위치를 확인해주세요.");
        }
      }
      return;
    }

    const blob = new Blob([fileText], { type: "text/javascript;charset=utf-8" });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = "content.js";
    anchor.click();
    URL.revokeObjectURL(downloadUrl);
    showStatus("content.js 다운로드됨");
  });

  resetButton.addEventListener("click", () => {
    const shouldReset = window.confirm("브라우저에 저장된 수정 내용을 초기화할까요?");
    if (!shouldReset) return;

    localStorage.removeItem(storageKey);
    portfolioContent = structuredClone(defaultContent);
    closeEditor();
  });

  if (startEditing) {
    isEditing = true;
    rerender();
    return;
  }

  syncToolbar();
  bindTextSizeEditor();
  bindProjectLinkEditor();
};

const bindHiddenEditorUnlock = () => {
  const brand = document.querySelector(".brand");
  let clickCount = 0;
  let resetTimer;

  brand.addEventListener("click", (event) => {
    if (clickCount === 0) {
      resetTimer = window.setTimeout(() => {
        clickCount = 0;
      }, 5000);
    }

    clickCount += 1;

    if (clickCount >= 10) {
      event.preventDefault();
      window.clearTimeout(resetTimer);
      clickCount = 0;
      createEditorToolbar({ startEditing: true });
    }
  });
};

document.addEventListener("click", (event) => {
  if (!isEditing) return;

  const target = event.target instanceof Element ? event.target : null;
  const link = target?.closest("a");
  if (link) {
    event.preventDefault();
  }
});

topButton.addEventListener("click", () => {
  topButton.classList.remove("is-visible");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

window.addEventListener(
  "scroll",
  () => {
    updateTopButton();
    updateScrollProgress();
    updateActiveNav();
  },
  { passive: true }
);

window.addEventListener("resize", () => {
  updateTopButton();
  updateScrollProgress();
  scheduleProfileLayoutMode();
});
window.addEventListener("load", scheduleProfileLayoutMode);

if ("ResizeObserver" in window) {
  const profilePanel = document.querySelector(".profile-panel");
  if (profilePanel) {
    new ResizeObserver(scheduleProfileLayoutMode).observe(profilePanel);
  }
}

refreshNavigationTargets();
bindNavigationEvents();
bindMobileNavigation();
bindHiddenEditorUnlock();
updateTopButton();
updateScrollProgress();
updateActiveNav();
