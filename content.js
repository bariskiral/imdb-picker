let isClicked = false;
let prevRnd = null;

// Clicking the "See More" button if there is one.

const getLoadButton = () => {
  const selectors = [
    ".ipc-see-more__button",
    ".ipc-see-more button"
  ];

  for (const selector of selectors) {
    const button = document.querySelector(selector);
    if (button) {
      return button;
    }
  }

  return Array.from(document.querySelectorAll("button")).find(button => {
    const buttonText = button.textContent.trim();
    const ariaLabel = button.getAttribute("aria-label") || "";
    const loadTextPattern =
      /^(?:(?:see|show|load)\s+)?(?:\d+\s+)?more$|^load more$/i;

    return (
      !button.disabled &&
      (loadTextPattern.test(buttonText) || loadTextPattern.test(ariaLabel))
    );
  });
};

const loadButtonClicker = async delay => {
  return await new Promise((resolve, reject) => {
    const clickLoadButton = () => {
      const loadButton = getLoadButton();

      if (loadButton) {
        isClicked = true;
        chrome.runtime.sendMessage({ isLoading: true });
        loadButton.click();
        setTimeout(() => {
          clickLoadButton();
        }, delay);
      } else {
        resolve();
      }
    };
    changeListView();
    clickLoadButton();
  }).catch(error => {
    console.error("Error occurred while loading: ", error);
  });
};

// Picking title from the list.

const pickContent = (delay, input) => {
  changeListView();
  const initialContent = document.querySelectorAll(
    ".ipc-metadata-list-summary-item"
  );
  const contentsArray = Array.from(initialContent).map((_content, index) => {
    const ratingText =
      _content.querySelector(".ipc-rating-star--imdb")?.textContent || "";
    const ratingMatch = ratingText.match(/\d+(?:\.\d+)?/);

    return {
      contentRating: ratingMatch ? +ratingMatch[0] : null,
      index
    };
  });

  const filteredContent = contentsArray.filter(content => {
    if (input === "0") {
      return content;
    } else {
      return content.contentRating >= +input;
    }
  });

  if (filteredContent.length > 0) {
    if (filteredContent.length > 1) {
      let rnd;
      do {
        rnd = Math.floor(Math.random() * filteredContent.length);
      } while (rnd === prevRnd);

      prevRnd = rnd;
      collectContent(initialContent[filteredContent[rnd].index], delay);
    } else {
      return collectContent(initialContent[filteredContent[0].index], delay);
    }
  } else {
    chrome.runtime.sendMessage({
      emptyContent: true,
      isLoading: false
    });
  }
};

const getText = element => element?.textContent.trim() || "";

const cleanMetadataText = text =>
  text
    .replace(/\d{1,3}\s*Metascore\b/gi, " ")
    .replace(/Metascore\b/gi, " ")
    .replace(/TV-(?:Y7|Y|G|PG|14|MA)(?=\d+\s*(?:h|m)|\D|$)/gi, " ")
    .replace(
      /\b(?:PG-13|NC-17|G|PG|R|Not Rated|Unrated|Approved|Passed)\b/gi,
      " "
    )
    .replace(/((?:18|19|20)\d{2})(?=\d+\s*(?:h|m))/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();

const getImdbRating = contents => {
  const ratingText = getText(contents.querySelector(".ipc-rating-star--imdb"));
  const ratingMatch = ratingText.match(/\d+(?:\.\d+)?(?:\s*\([^)]*\))?/);

  return ratingMatch ? ratingMatch[0] : "Not Released";
};

const getTitleMetadata = contents => {
  const metadataSelectors = [
    ".dli-title-metadata span",
    ".dli-title-metadata-item",
    "[data-testid*='metadata' i] span",
    "[class*='title-metadata' i] span",
    "[class*='titleMetadata' i] span",
    "[class*='metadata' i] span",
    "[class*='metadata' i] li"
  ];
  const metadata = Array.from(
    contents.querySelectorAll(metadataSelectors.join(","))
  )
    .map(element => cleanMetadataText(getText(element)))
    .filter(Boolean);
  const fallbackText = cleanMetadataText(getText(contents));
  const searchableText = [...metadata, fallbackText].join(" ");
  const yearMatch = searchableText.match(/(?:^|\D)((?:18|19|20)\d{2})(?=\D|$)/);
  const runtimeMatch = searchableText.match(
    /\b(?:\d+\s*h(?:\s*\d+\s*m(?:in)?)?|\d+\s*m(?:in)?)\b/i
  );

  return {
    year: yearMatch ? yearMatch[1] : "Year TBA",
    runtime: runtimeMatch ? runtimeMatch[0] : "Run Time TBA"
  };
};

// Getting the data of the selected title.

const collectContent = async (contents, delay) => {
  isClicked = true;

  chrome.runtime.sendMessage({
    isLoading: true
  });

  const rndContentName = (
    contents.querySelector(".ipc-title__text")?.textContent || "UNKNOWN TITLE"
  ).replace(/^\s*\d+\.\s*/, "");
  const rndContentLink =
    contents.querySelector(".ipc-title-link-wrapper")?.href || "#";
  const rndContentImage = await new Promise(resolve => {
    setTimeout(() => {
      resolve(
        contents.querySelector(".ipc-image")
          ? contents.querySelector(".ipc-image").src
          : "/media/logos/IMDb_Logo_128_Alt.png"
      );
    }, delay / 2);
  }).catch(error => {
    console.error("Error occurred during image retrieval: ", error);
    return "/media/logos/IMDb_Logo_128_Alt.png";
  });
  const { year: rndContentYear, runtime: rndContentRuntime } =
    getTitleMetadata(contents);
  const rndContentImdbRating = getImdbRating(contents);

  if (isClicked) {
    chrome.runtime.sendMessage({
      content: {
        rndContentName,
        rndContentLink,
        rndContentImage,
        rndContentYear,
        rndContentRuntime,
        rndContentImdbRating
      },
      isLoading: false
    });
    isClicked = false;
  }
};

// Scroll to the bottom of the page to trigger lazy loading.

const scrollToBottom = delay => {
  window.scrollTo(0, document.body.scrollHeight);
  const scrollInterval = setInterval(function () {
    if (window.scrollY + window.innerHeight >= document.body.scrollHeight) {
      clearInterval(scrollInterval);
      chrome.runtime.sendMessage({ isLoading: false });
      isClicked = false;
      window.scrollTo(0, 0);
    } else {
      window.scrollTo(0, document.body.scrollHeight);
    }
  }, delay);
};

// Change the list view if the user uses a different view. This is necessary to get the data properly.

const changeListView = () => {
  const viewButton = document.querySelector("#list-view-option-detailed");
  const listView = document.querySelector(".detailed-list-view");

  if (!listView && viewButton) {
    viewButton.click();
  }
};

const filterButtonClicker = () => {
  document.querySelector(".ipc-chip-dropdown__chip")?.click();
};

// Getting messages from popup.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const delay = message.delay;
  const input = message.input;
  if (message.command === "loadButton" && !isClicked) {
    loadButtonClicker(delay)
      .then(() => {
        scrollToBottom(delay);
      })
      .catch(error => {
        console.error("Error occurred while loading: ", error);
      });
  } else if (message.command === "pickButton" && !isClicked) {
    pickContent(delay, input);
  } else if (message.command === "filterButton") {
    filterButtonClicker();
  }
});
