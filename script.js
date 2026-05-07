const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const toSectionLink = (target = "") => `#${target.replace(/^#/, "")}`;
const storageKey = "junior-portfolio-content-v13";
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
    project.links?.forEach((link, linkIndex) => {
      const defaultUrl =
        defaultContent.projects?.items?.[projectIndex]?.links?.[linkIndex]?.url || "";

      if (!link.url && defaultUrl) {
        link.url = defaultUrl;
      }
    });
  });

  return content;
};

let portfolioContent = applyProjectLinkDefaults(loadContent());
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
    const value = input.dataset.editInput.endsWith(".url")
      ? normalizeUrl(input.value)
      : input.value.trim();

    setByPath(portfolioContent, input.dataset.editInput, value);
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

const renderProjectLinks = (links = [], basePath = "") => {
  const buttons = links
    .map((link, index) => {
      const href = normalizeUrl(link.url);

      if (href) {
        return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(
          `${link.label} 링크`
        )}">${escapeHtml(link.label)}</a>`;
      }

      return `<button type="button" aria-disabled="true" aria-label="${escapeHtml(
        `${link.label} 링크`
      )}">${escapeHtml(link.label)}</button>`;
    })
    .join("");

  const fields = isEditing
    ? `<div class="project-link-fields">
        ${links
          .map(
            (link, index) => `
              <label class="project-link-field">
                <span>${escapeHtml(link.label)} URL</span>
                <input
                  type="url"
                  data-edit-input="${basePath}.${index}.url"
                  value="${escapeHtml(link.url || "")}"
                  placeholder="https://..."
                />
              </label>
            `
          )
          .join("")}
      </div>`
    : "";

  return `<div class="project-link-buttons">${buttons}</div>${fields}`;
};

const getProfileLinkValue = (link = {}) =>
  link.value || String(link.url || "").replace(/^mailto:/i, "").replace(/^https?:\/\//i, "");

const getProfileLinkAttributes = (href = "") =>
  /^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : "";

const renderProfileLinks = (links = []) =>
  links
    .map((link, index) => {
      const href = normalizeUrl(link.url);
      const value = getProfileLinkValue(link);

      if (!isEditing) {
        if (!href) {
          return `
            <div class="profile-link-row">
              <dt>${escapeHtml(link.label)}</dt>
              <dd class="profile-link-empty">${escapeHtml(value)}</dd>
            </div>
          `;
        }

        return `
          <div class="profile-link-row">
            <dt>${escapeHtml(link.label)}</dt>
            <dd>
              <a
                class="profile-stat-link"
                href="${escapeHtml(href)}"
                aria-label="${escapeHtml(`${link.label} 링크`)}"
                ${getProfileLinkAttributes(href)}
              >${escapeHtml(value)}</a>
            </dd>
          </div>
        `;
      }

      return `
        <div class="profile-link-row is-editing-link">
          <dt ${editable(
              `profile.links.${index}.label`,
              link.label
            )}</dt>
          <dd>
            <span ${editable(
              `profile.links.${index}.value`,
              value
            )}</span>
          </dd>
          <label class="profile-link-field">
            <span>URL</span>
            <input
              type="text"
              data-edit-input="profile.links.${index}.url"
              value="${escapeHtml(link.url || "")}"
              placeholder="mailto: 또는 https://"
            />
          </label>
        </div>
      `;
    })
    .join("");

const renderPortfolio = (content) => {
  if (!content) return;

  document.title = content.meta?.title || document.title;

  const description = document.querySelector('meta[name="description"]');
  if (description && content.meta?.description) {
    description.setAttribute("content", content.meta.description);
  }

  document.querySelector(".brand-mark").textContent = content.brand?.mark || "D";
  document.querySelector(".brand span:last-child").textContent =
    content.brand?.name || "개발자 포트폴리오";

  document.querySelector(".nav-links").innerHTML = content.nav
    .map(
      (item, index) =>
        `<a href="${toSectionLink(item.target)}" data-edit="nav.${index}.label">${escapeHtml(
          item.label
        )}</a>`
    )
    .join("");

  document.querySelector(".hero-content").innerHTML = `
    <h1 ${editable("hero.title", content.hero.title)}</h1>
    <p class="hero-copy" ${editable("hero.description", content.hero.description)}</p>
  `;

  const avatarMarkup = content.profile.image
    ? `<img src="${escapeHtml(content.profile.image)}" alt="${escapeHtml(
        `${content.profile.name} 프로필 이미지`
      )}" />`
    : escapeHtml(content.profile.avatarText || "DEV");
  const avatarAttributes = isEditing
    ? 'data-avatar-edit="true" role="button" tabindex="0" aria-label="프로필 이미지 변경"'
    : `aria-hidden="${content.profile.image ? "false" : "true"}"`;

  document.querySelector(".profile-panel").innerHTML = `
    <div class="avatar${isEditing ? " is-editable-avatar" : ""}" ${avatarAttributes}>
      ${avatarMarkup}
    </div>
    <div>
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
                ${renderProjectLinks(project.links, `projects.items.${projectIndex}.links`)}
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

};

renderPortfolio(portfolioContent);

const topButton = document.querySelector(".top-button");
const scrollProgress = document.querySelector(".scroll-progress");
const navShell = document.querySelector(".nav-shell");
const mobileNavToggle = document.querySelector(".mobile-nav-toggle");
const mobileNavLabel = document.querySelector(".mobile-nav-label");
let navLinks = [];
let sections = [];

const refreshNavigationTargets = () => {
  navLinks = Array.from(document.querySelectorAll(".nav-links a"));
  sections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
};

const updateTopButton = () => {
  topButton.classList.toggle("is-visible", window.scrollY > 520);
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
    <input class="editor-image-input" type="file" accept="image/*" hidden />
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
  const imageInput = toolbar.querySelector(".editor-image-input");

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

  const bindAvatarEditor = () => {
    const avatar = document.querySelector("[data-avatar-edit='true']");
    if (!avatar) return;

    const openImagePicker = () => imageInput.click();

    avatar.addEventListener("click", openImagePicker);
    avatar.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;

      event.preventDefault();
      openImagePicker();
    });
  };

  const bindTextSizeEditor = () => {
    document
      .querySelectorAll("[data-edit][contenteditable='true']")
      .forEach((element) => {
        element.addEventListener("focus", () => setActiveEditable(element));
        element.addEventListener("click", () => setActiveEditable(element));
      });
  };

  const rerender = () => {
    renderPortfolio(portfolioContent);
    refreshNavigationTargets();
    bindNavigationEvents();
    bindAvatarEditor();
    bindTextSizeEditor();
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

  imageInput.addEventListener("change", () => {
    const [file] = imageInput.files;
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      portfolioContent.profile.image = reader.result;
      saveToBrowser();
      rerender();
    });
    reader.readAsDataURL(file);
    imageInput.value = "";
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
  bindAvatarEditor();
  bindTextSizeEditor();
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
  if (link && !link.classList.contains("brand")) {
    event.preventDefault();
  }
});

topButton.addEventListener("click", () => {
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

window.addEventListener("resize", updateScrollProgress);

refreshNavigationTargets();
bindNavigationEvents();
bindMobileNavigation();
bindHiddenEditorUnlock();
updateTopButton();
updateScrollProgress();
updateActiveNav();
