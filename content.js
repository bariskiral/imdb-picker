let isClicked = false;

// Clicking the "LOAD MORE" button until there is no "LOAD MORE" button.

const loadButtonClicker = delay => {
  const loadButton = document.querySelector(".load-more");
  isClicked = true;

  chrome.runtime.sendMessage({
    isLoading: true
  });

  if (loadButton) {
    loadButton.click();

    return new Promise(resolve => {
      setTimeout(() => {
        resolve(loadButtonClicker(delay));
        scrollToAnchor();
      }, delay);
    });
  } else {
    chrome.runtime.sendMessage({
      isLoading: false
    });
    isClicked = false;

    setTimeout(() => {
      window.scrollTo(0, 0);
    }, delay / 2);
  }
};

// Filtering the content element with rating and type input and then picking a random element.

const pickContent = (delay, type, input) => {
  const initialContent = document.querySelectorAll(".lister-item");

  const contentsArray = Array.from(initialContent).map((_content, index) => ({
    contentRating: _content.querySelector(".ratings-imdb-rating"),
    contentType: _content.classList.contains("featureFilm"),
    index
  }));

  const filteredContent = contentsArray.filter(content => {
    if (input === "0" && type === "1") {
      return content;
    } else if (content.contentRating && type === "1") {
      return +content.contentRating.textContent >= +input;
    } else if (content.contentRating && type === "2") {
      return +content.contentRating.textContent >= +input && content.contentType;
    } else if (content.contentRating && type === "3") {
      return +content.contentRating.textContent >= +input && !content.contentType;
    } else if (input === "0" && type === "2") {
      return content.contentType;
    } else if (input === "0" && type === "3") {
      return !content.contentType;
    } else {
      return false;
    }
  });

  if (filteredContent.length > 0) {
    const rnd = Math.floor(Math.random() * filteredContent.length);
    collectContent(initialContent[filteredContent[rnd].index], delay);
  } else {
    chrome.runtime.sendMessage({
      emptyContent: true
    });
  }
};

// Collecting all the data from select random element.

const collectContent = async (contents, delay) => {
  isClicked = true;

  chrome.runtime.sendMessage({
    isLoading: true
  });

  contents.scrollIntoView();

  const rndContentName = contents.querySelector(".lister-item-header a")?.textContent || "UNKNOWN";
  const rndContentLink = contents.querySelector(".lister-item-header a")?.href || "#";
  const rndContentImage = await new Promise(resolve => {
    setTimeout(() => {
      resolve(
        contents.querySelector(".lister-item-image a img").src.includes("https://m.media-amazon.com")
          ? contents.querySelector(".lister-item-image a img").src
          : "/media/logos/IMDb_Logo_128_Alt.png"
      );
    }, delay / 2);
  });
  const rndContentYear = contents.querySelector(".lister-item-year")?.textContent || "Year TBA";
  const rndContentRuntime = contents.querySelector(".runtime")
    ? contents.querySelector(".runtime").textContent
    : contents.classList.contains("featureFilm")
    ? "Run Time TBA"
    : contents
        .querySelector(".lister-item-details")
        .children[2].textContent.replace(/(\d+)eps/g, "$1 Episodes TV Series");
  const rndContentGenres = contents.querySelector(".genre")?.textContent || "Genres are not Available";
  const rndContentImdbRating = contents.querySelector(".ratings-imdb-rating")?.textContent || "Not Released";

  if (isClicked) {
    chrome.runtime.sendMessage({
      content: {
        rndContentName,
        rndContentLink,
        rndContentImage,
        rndContentYear,
        rndContentRuntime,
        rndContentGenres,
        rndContentImdbRating
      },
      isLoading: false
    });
    isClicked = false;
  }
};

// Scrolling to ".lister-page-anchor" named elements to stop lazy loading.

const scrollToAnchor = () => {
  const listerPageAnchor = document.querySelectorAll(".lister-page-anchor");
  Array.from(listerPageAnchor).map(anchor => {
    return anchor.scrollIntoView();
  });
};

// Listen messages for buttons.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const delay = message.delay;
  const type = message.type;
  const input = message.input;
  if (message.command === "loadButtonClicker" && !isClicked) {
    Promise.all([loadButtonClicker(delay), scrollToAnchor()]);
  } else if (message.command === "pickContent" && !isClicked) {
    pickContent(delay, type, input);
  }
});
