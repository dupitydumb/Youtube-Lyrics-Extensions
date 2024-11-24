let plainLyrics = "I'm sorry, I cannot find the lyrics for this song.";
let syncLyrics = [];
let isSyncLyrics = false;
let artistNameElement = "";
let delay = 0;
let hasRun = false;
let isEnabled = false;

//get the stored data of on/off switch
chrome.storage.sync.get("isEnabled", function (data) {
  if (data.isEnabled) {
    //if the switch is on, run the content script
    isEnabled = true;
  } else {
    isEnabled = false;
  }
});

//add event listener to the storage
chrome.storage.onChanged.addListener(function (changes, namespace) {
  for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
    if (key === "isEnabled") {
      if (newValue) {
        isEnabled = true;
        //refresh the page
        location.reload();
      } else {
        isEnabled = false;
        location.reload();
      }
    }
  }
});

//get color settings from the storage
chrome.storage.sync.get(["backgroundColor", "textColor"], function (data) {
  if (data.backgroundColor) {
  }
  if (data.textColor) {
    document.body.style.color = data.textColor;
  }
});

window.onload = function () {
  const currentURL = window.location.href;
  // Allow the extension to run only on YouTube video URLs
  const videoURLPattern = /^https:\/\/www\.youtube\.com\/watch\?v=/;
  let currentTittle = "";
  function initialize() {
    if (videoURLPattern.test(window.location.href)) {
      console.log("This is a YouTube video page");

      // Inject Tailwind CSS
      injectTailwindCSS();

      const observer = new MutationObserver((mutations, obs) => {
        const itemsDiv = document.querySelector("#secondary-inner");
        const title = document.querySelector(
          "#title > h1 > yt-formatted-string"
        );
        if (itemsDiv && !hasRun && title) {
          console.log(itemsDiv);
          const videoTitleElement = document.querySelector(
            "#title > h1 > yt-formatted-string"
          );
          currentTittle = document.querySelector(
            "#title > h1 > yt-formatted-string"
          ).innerHTML;
          const artistNameElementNode = document.querySelector("#text > a");
          if (artistNameElementNode) {
            artistNameElement = artistNameElementNode.innerHTML;
          } else {
            artistNameElement = "Unknown Artist";
          }
          const videoTitle = videoTitleElement
            ? videoTitleElement.textContent + " |" + artistNameElement
            : "No title found";
          // Extract the video title
          if (!isEnabled) {
            return;
          }
          console.log("Video title:", formattedTitle(videoTitle));
          getLyrics(formattedTitle(videoTitle));
          createNewDiv(itemsDiv);
          // Create style if isSyncLyrics is true
          hasRun = true;
          obs.disconnect(); // Stop observing once the target element is found
        }
      });

      // Start observing the document body for changes
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  }

  // Initialize on page load
  initialize();

  let lastTitle = currentTittle;
  // Listen for title changes
  new MutationObserver(() => {
    const title = document.querySelector("#title > h1 > yt-formatted-string");
    if (title && title.textContent !== lastTitle) {
      lastTitle = title.textContent;
      hasRun = false; // Reset the flag to allow re-initialization
      initialize();
    }
  }).observe(document, { subtree: true, childList: true });

  // // Listen for URL changes
  // let lastUrl = currentURL;
  // new MutationObserver(() => {
  //   const url = window.location.href;
  //   if (url !== lastUrl) {
  //     lastUrl = url;
  //     hasRun = false; // Reset the flag to allow re-initialization
  //     initialize();
  //   }
  // }).observe(document, { subtree: true, childList: true });
};

let hasTryAgain = false;
let datas = [];
function getLyrics(title) {
  let url = "https://lrclib.net/api/search?q=" + title;
  console.log("Trying with title : " + title);
  if (hasTryAgain) {
    url = "https://lrclib.net/api/search?q=" + formattedSongTitleOnly(title);
    console.log(
      "Trying again with formatted title : " + formattedSongTitleOnly(title)
    );
  }
  fetch(url)
    .then((response) => response.json())
    .then((data) => {
      console.log(data);
      if (data.length === 0 && !hasTryAgain) {
        console.log(
          "Data not found, trying again with formatted title :" + title
        );
        hasTryAgain = true;
        getLyrics(title);
        return;
      }
      if (data.length > 0) {
        datas = data;
        let selectedData = searchData(artistNameElement);
        plainLyrics = selectedData.plainLyrics;
        syncLyrics = parseSyncLyrics(selectedData.syncedLyrics);
        updateTitle(selectedData.trackName);
        generateSyncLyrics();
        displayDataOptions();
        var lyricsTypeSelect = document.querySelector("select");
        if (syncLyrics.length > 0 && syncLyrics[0] !== null) {
          isSyncLyrics = true;
          //Set the default value to current isSyncLyrics value
          lyricsTypeSelect.value = "sync";
          startSyncLyrics();
        } else {
          isSyncLyrics = false;
          //Set the default value to current isSyncLyrics value
          lyricsTypeSelect.value = "plain";
          setLyrics(plainLyrics);
        }
      } else {
      }
    })
    .catch((error) => {
      startSyncLyrics();
      if (syncLyrics.length > 0) {
        startSyncLyrics();
      } else {
        setLyrics(plainLyrics);
        console.error("Error:", error);
      }
    });
}

function searchData(artistName) {
  for (let i = 0; i < datas.length; i++) {
    //If artistNameElement is close to the artistName in the data, return the data
    if (datas[i].artistName.includes(artistName)) {
      return datas[i];
    } else {
      return datas[0];
    }
  }
}

function displayDataOptions() {
  const lyricPanel = document.querySelector("#Lyric-Panel");
  if (lyricPanel) {
    if (document.getElementById("Data-Options")) {
      //clear the data options container
      document.getElementById("Data-Options").remove();
    }
    // Create a container for the data options
    const dataOptionsContainer = document.createElement("div");
    dataOptionsContainer.id = "Data-Options";
    dataOptionsContainer.className =
      "mt-6 p-6 bg-gray-100 rounded-lg shadow-md flex";

    // Create a label for the data options
    const dataOptionsLabel = document.createElement("span");
    dataOptionsLabel.textContent = "Other available lyrics:";
    dataOptionsLabel.className = "block mb-2 text-sm font-medium text-gray-700";
    dataOptionsContainer.appendChild(dataOptionsLabel);

    // Create a dropdown menu for the data options
    const dataOptionsSelect = document.createElement("select");
    dataOptionsSelect.className =
      "block w-full mt-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm";
    dataOptionsContainer.appendChild(dataOptionsSelect);

    // Use a Set to track unique trackName and artistName combinations
    const uniqueTracks = new Set();

    // Add options to the dropdown menu
    datas.forEach((data, index) => {
      const trackArtistCombo = `${data.trackName} - ${data.artistName}`;
      if (!uniqueTracks.has(trackArtistCombo)) {
        uniqueTracks.add(trackArtistCombo);
        const option = document.createElement("option");
        option.value = index;
        option.textContent = trackArtistCombo;
        dataOptionsSelect.appendChild(option);
      }
    });
    // Add event listener to the dropdown menu
    dataOptionsSelect.addEventListener("change", (event) => {
      const selectedIndex = event.target.value;
      const selectedData = datas[selectedIndex];
      plainLyrics = selectedData.plainLyrics;
      syncLyrics = parseSyncLyrics(selectedData.syncedLyrics);
      setLyrics(plainLyrics);
      generateSyncLyrics();
      updateTitle(selectedData.trackName);
    });
    document.querySelector("#Setting-Panel").appendChild(dataOptionsContainer);
  }
}

function formattedTitle(title) {
  const notallowed = [
    "official",
    "video",
    "lyric",
    "music",
    "audio",
    "mv",
    "M/V",
    "(Official Video)",
  ];
  //Add all korean characters to the not allowed list
  for (let i = 44032; i <= 55203; i++) {
    notallowed.push(String.fromCharCode(i));
  }
  //Remove the not allowed words from the title
  let formattedTitle = title.toLowerCase().split(" ");
  formattedTitle = formattedTitle
    .filter((word) => !notallowed.includes(word))
    .join(" ");

  // If the title has a pipe, remove the text after the pipe
  if (formattedTitle.includes("|") && formattedTitle.includes("-")) {
    formattedTitle = formattedTitle.split("|")[0];
  }
  return formattedTitle;
}

function formattedSongTitleOnly(title) {
  notallowed = [
    "MV",
    "M/V",
    "Official",
    "Video",
    "Lyric",
    "Music",
    "Audio",
    "Live",
    "clip",
    "'",
  ];
  //if it not alpabet, remove it

  let formattedTitle = title.toLowerCase().split(" ");
  formattedTitle = formattedTitle
    .filter(
      (word) => !notallowed.includes(word) && !/[\uAC00-\uD7AF]/.test(word)
    )
    .join(" ");
  //if formatted tittle has |, split the title and get the first part
  if (formattedTitle.includes("|")) {
    formattedTitle = formattedTitle.split("|")[0];
  }

  return formattedTitle;
}
let isVideoPlaying = false;
function startSyncLyrics() {
  if (!isSyncLyrics) {
    return;
  }
  const videoElement = document.getElementsByTagName("video")[0];
  isVideoPlaying = true;
  videoElement.addEventListener("play", () => {
    isVideoPlaying = true;
  });
  videoElement.addEventListener("pause", () => {
    isVideoPlaying = false;
  });
  videoElement.addEventListener("timeupdate", () => {
    if (isVideoPlaying) {
      updateLyrics();
    }
  });

  isSyncLyrics = true;
  const style = document.createElement("style");
  style.textContent = `
            #Lyric-Body {
                font-size: 26px;
                font-weight: bold;    
                margin: 0;
                padding: 8px;
                transition: color 0.5s;
                text-align: center;
            }
            #Lyric-Body p {
                animation: glow 1s ease-in-out infinite alternate;
                text-shadow: 0px 15px 26px rgba(0,0,0,0.6);
                margin: 0;
                padding: 8px;
            }
            `;
  document.head.appendChild(style);
  function updateLyrics() {
    console.log("Checking for current lyric");
    const currentTime = getCurrentVideoTime() + -delay;
    if (currentTime !== null) {
      const currentLyric = syncLyrics.find(
        (lyric) => lyric.time <= currentTime && lyric.time + 2 >= currentTime
      );
      console.log("Current time:", currentTime);
      if (currentLyric) {
        console.log("Setting current lyric to", currentLyric.text);
        setSyncLyrics(currentLyric.text);
      } else {
        //if the currentLyric is not found, set current lyric to the closest lyric with time less than current time
        // const closestLyric = syncLyrics.reduce((a, b) =>
        //   Math.abs(b.time - currentTime) < Math.abs(a.time - currentTime)
        //     ? b
        //     : a
        // );
        // console.log("Setting current lyric to", closestLyric.text);
        // setSyncLyrics(closestLyric.text);
      }
    }
  }
}

function parseSyncLyrics(syncedLyrics) {
  const lines = syncedLyrics.split("\n");
  return lines
    .map((line) => {
      const match = line.match(/\[(\d{2}:\d{2}\.\d{2})\] (.*)/);
      if (match) {
        const timeParts = match[1].split(":");
        const timeInSeconds =
          parseInt(timeParts[0]) * 60 + parseFloat(timeParts[1]);
        return { time: timeInSeconds, text: match[2] };
      }
      return null;
    })
    .filter((line) => line !== null);
}
function updateTitle(title) {
  const titleElement = document.querySelector("#Lyric-Title");
  if (titleElement) {
    titleElement.textContent = title;
  }
}

function createNewDiv(itemsDiv) {
  if (document.getElementById("Lyric-Panel")) {
    return;
  }

  const videoTitleElement = document.querySelector(
    "#title > h1 > yt-formatted-string"
  );
  const videoTitle = videoTitleElement
    ? videoTitleElement.textContent
    : "No title found";
  const newDiv = document.createElement("div");
  newDiv.id = "Lyric-Panel";
  // Add CSS for #Lyric-Panel
  itemsDiv.prepend(newDiv);

  //Create title for the lyrics panel
  const title = document.createElement("h2");
  title.textContent = `${videoTitle}`;
  title.id = "Lyric-Title";
  title.style.textAlign = "center";
  title.style.fontSize = "18px";
  title.style.marginBottom = "16px";
  newDiv.prepend(title);
  // Add the new div to the document body for lyrics
  const lyricBody = document.createElement("div");
  lyricBody.id = "Lyric-Body";
  newDiv.appendChild(lyricBody);
  // Add delay control panel
  const secondaryInner = document.querySelector("#secondary-inner");
  const settingPanel = document.createElement("div");
  settingPanel.id = "Setting-Panel";
  settingPanel.className =
    "mt-2 p-2 bg-gray-100 rounded-lg shadow-md flex flex-col items-left";
  //
  //Make setting panell. contains delay control, lyrics type control. and lyrics language control
  const delayPanel = document.createElement("div");
  delayPanel.className = "flex flex-row items-center";
  const delayLabel = document.createElement("label");
  delayLabel.textContent = "Delay (s):";
  delayLabel.className = "mr-2";
  const delayInput = document.createElement("input");
  delayInput.type = "number";
  delayInput.value = 0;
  delayInput.min = -200;
  delayInput.max = 200;
  delayInput.className =
    "border border-gray-300 rounded-lg p-1 focus:outline-none";
  delayInput.addEventListener("input", (e) => {
    delay = parseInt(e.target.value);
  });
  settingPanel.appendChild(delayLabel);
  settingPanel.appendChild(delayInput);

  //Switch between plain lyrics and sync lyrics
  const lyricsTypePanel = document.createElement("div");
  lyricsTypePanel.className = "flex flex-row items-center";
  const lyricsTypeLabel = document.createElement("label");
  lyricsTypeLabel.textContent = "Lyrics Type:";
  lyricsTypeLabel.className = "mr-2";
  const lyricsTypeSelect = document.createElement("select");
  lyricsTypeSelect.className =
    "border border-gray-300 rounded-lg p-1 focus:outline-none";
  const plainLyricsOption = document.createElement("option");
  plainLyricsOption.value = "plain";
  plainLyricsOption.textContent = "Plain Lyrics";
  const syncLyricsOption = document.createElement("option");
  syncLyricsOption.value = "sync";
  syncLyricsOption.textContent = "Synced Lyrics";
  lyricsTypeSelect.appendChild(plainLyricsOption);
  lyricsTypeSelect.appendChild(syncLyricsOption);
  lyricsTypeSelect.addEventListener("change", (e) => {
    if (e.target.value === "sync") {
      isSyncLyrics = true;
    } else {
      isSyncLyrics = false;
    }
  });
  lyricsTypePanel.appendChild(lyricsTypeLabel);
  lyricsTypePanel.appendChild(lyricsTypeSelect);
  settingPanel.appendChild(lyricsTypePanel);
  secondaryInner.insertBefore(settingPanel, secondaryInner.childNodes[1]);
  const style = document.createElement("style");
  style.textContent = `
        #Lyric-Panel {
          background-color: #f9fafb; /* Light gray background */
          padding: 16px; /* Padding */
          margin: 8px 0; /* Margin */
          border: 1px solid #e5e7eb; /* Border */
          border-radius: 8px; /* Rounded corners */
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); /* Shadow */
          font-family: 'Arial', sans-serif; /* Font */
          color: #374151; /* Text color */
          text-align: left; /* Text alignment */
          font-size: 24px; /* Font size */
          background-color: ${document.body.style.LyricsbackgroundColor}; /* Background color */
        }
        #Lyric-Body {
          max-height: 300px; /* Fixed height */
          overflow-y: auto; /* Scrollable */
          padding: 8px; /* Padding */
          background-color: #ffffff; /* White background */
          border-top: 1px solid #e5e7eb; /* Top border */
          font-size: 16px; /* Font size */
          color: ${document.body.style.Lyricscolor}; /* Text color */
        }
      `;
  document.head.appendChild(style);
}

function injectTailwindCSS() {
  const link = document.createElement("link");
  link.href =
    "https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css";
  link.rel = "stylesheet";
  document.head.appendChild(link);
}

function setLyrics(lyrics) {
  const lyricPanel = document.querySelector("#Lyric-Body");
  if (lyricPanel) {
    // Clear existing content
    lyricPanel.innerHTML = "";

    // Split lyrics by line breaks and create a new paragraph for each line
    const lines = lyrics.split("\n");
    lines.forEach((line) => {
      const p = document.createElement("p");
      p.textContent = line;
      lyricPanel.appendChild(p);
    });
  }
}

function setSyncLyrics(lyrics) {
  const lyricPanel = document.querySelector("#Lyric-Body");
  if (lyricPanel) {
    //One lyric before and after the current lyric
    const currentIndex = syncLyrics.findIndex((lyric) => lyric.text === lyrics);
    const previousLyric = syncLyrics[currentIndex - 1];
    const currentLyric = syncLyrics[currentIndex];
    const nextLyric = syncLyrics[currentIndex + 1];

    if (previousLyric < 0) {
      previousLyric = syncLyrics[0];
    }

    if (nextLyric < 0) {
      nextLyric = syncLyrics[syncLyrics.length - 1];
    }

    // sync the lyricsElement with the currentLyric based on the index
    lyricElements.forEach((element) => {
      element.style.opacity = "0.2";
      element.style.filter = "blur(5px)";
      //set it to the store color
    });
    lyricElements[currentIndex].style.opacity = "1";
    lyricElements[currentIndex].style.filter = "none";
    //Change opacity of the previous and next lyric
    if (previousLyric) {
      lyricElements[currentIndex - 1].style.opacity = "0.2";
      //blur the previous lyric
      lyricElements[currentIndex - 1].style.filter = "blur(2px)";
    }
    if (nextLyric) {
      lyricElements[currentIndex + 1].style.opacity = "0.2";
      //blur the next lyric
      lyricElements[currentIndex + 1].style.filter = "blur(2px)";
    }

    //Set the current lyric to the center of the panel
    lyricPanel.scrollTop = lyricElements[currentIndex].offsetTop - 200;
  }
}

//New list of lyrics elements
let lyricElements = [];
function generateSyncLyrics() {
  if (document.getElementById("Lyric-Body")) {
    //remove all p elements in the lyric panel
    const lyricPanel = document.querySelector("#Lyric-Body");
    lyricPanel.innerHTML = "";
    lyricElements = [];
  }
  for (let i = 0; i < syncLyrics.length; i++) {
    const lyricPanel = document.querySelector("#Lyric-Body");
    const p = document.createElement("p");
    p.textContent = syncLyrics[i].text;
    lyricPanel.appendChild(p);
    lyricElements.push(p);
    //create style for the lyric elements
    const style = document.createElement("style");
    style.textContent = `
            #Lyric-Body p {
                transition: color 0.5s;
            }
            `;
    document.head.appendChild(style);
  }
}

function getCurrentVideoTime() {
  return document.getElementsByTagName("video")[0].currentTime;
}
