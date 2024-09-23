
const FEED_HANDLES_SELECTOR = `.css-146c3p1.r-dnmrzs.r-1udh08x.r-3s2u2q.r-bcqeeo.r-1ttztb7.r-qvutc0.r-37j5jr.r-a023e6.r-rjixqe.r-16dba41.r-18u37iz.r-1wvb978`;
const FEED_HANDLES_SELECTOR_SSR = `.css-146c3p1.r-dnmrzs.r-1udh08x.r-3s2u2q.r-bcqeeo.r-1ttztb7.r-qvutc0.r-37j5jr.r-a023e6.r-rjixqe.r-16dba41.r-18u37iz.r-1wvb978`;
const FEED_HANDLES_SELECTOR_DARK_MODE = `.css-146c3p1.r-dnmrzs.r-1udh08x.r-3s2u2q.r-bcqeeo.r-1ttztb7.r-qvutc0.r-37j5jr.r-a023e6.r-rjixqe.r-16dba41.r-18u37iz.r-1wvb978`;
const FEED_HANDLES_SELECTOR_DIM_MODE = `.css-146c3p1.r-dnmrzs.r-1udh08x.r-3s2u2q.r-bcqeeo.r-1ttztb7.r-qvutc0.r-37j5jr.r-a023e6.r-rjixqe.r-16dba41.r-18u37iz.r-1wvb978`;

const HOVER_CARD_SELECTOR = `div[data-testid="HoverCard"] .css-175oi2r.r-kemksi.r-qo02w8.r-1867qdf`;

const PROFILE_PAGE_SELECTOR = `div[data-testid="UserName"]`;

let currentUsersHandle = null;

const userNameNodes = new Set();
const userTrackedSet = new Set();
const hoverCardSet = new Set();
const hoverPopoverTrackedSet = new Set();
const loggedUserBookmarkedCommunities = new Set();

const userDataMap = {};
const highlightedHex = "#FF5733";

const KONTEXT_ICON_SVG = `<svg width="12" height="12" style="position: relative; top: 1px;" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.16987 2.78868L5 0.57735L8.83013 2.78868V7.21133L5 9.42265L1.16987 7.21133V2.78868Z" stroke="#5640FF"/></svg>`;
const KONTEXT_ICON_FILLED_SVG = `<svg width="16" height="16" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8.5 0.1875L15.6988 4.34375V12.6562L8.5 16.8125L1.30116 12.6562V4.34375L8.5 0.1875Z" fill="#5640FF"/><path d="M4.3833 8.86415L7.34413 11.825L12.2525 6.4654L11.0887 5.38873L7.28872 9.52915L5.49955 7.73998L4.3833 8.86415Z" fill="white"/></svg>`;
const UP_ARROW_SVG = `
  <svg
    width="12"
    height="14"
    viewBox="0 0 12 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fill-rule="evenodd"
      clip-rule="evenodd"
      d="M10.1477 10.1404C9.92808 10.3601 9.57192 10.3601 9.35225 10.1404L6 6.78816L2.64775 10.1404C2.42808 10.3601 2.07192 10.3601 1.85225 10.1404C1.63258 9.92075 1.63258 9.56459 1.85225 9.34492L6 5.19717L10.1477 9.34492C10.3674 9.56459 10.3674 9.92075 10.1477 10.1404Z"
      fill="#536471"
    />
  </svg>
`;

const formatNumber = (number) =>
  Intl.NumberFormat(navigator.language).format(number).replace(/\s/, " ");

const handleToScreenName = (handle) => {
  if (!handle) return handle;
  return handle.startsWith("@") ? handle.substring(1) : handle;
};

const renderIcon = ({ filled, isBookmarked }) => {
  const makeIcon = filled ? KONTEXT_ICON_FILLED_SVG : KONTEXT_ICON_SVG;
  const makeDot = isBookmarked
    ? `<span title="${
        filled
          ? "This user is in atleast one of your bookmarked communities on kontext.news"
          : "This is one of your bookmarked communities on kontext.news"
      }" class="bookmarkedDot" style="background-color: ${highlightedHex};"></span>`
    : ``;

  return `<span class="kontextIcon ${
    filled ? "filled" : ""
  }">${makeIcon}${makeDot}</span>`;
};

const querySelectorAllIncludingMe = (node, selector) => {
  if (node.matches(selector)) {
    return [node];
  }
  return [...node.querySelectorAll(selector)];
};

const addHiddenCommunitiesToggleEvent = (node) => {
  const toggleElement = querySelectorAllIncludingMe(
    node,
    ".hidden-communities-title"
  );
  if (toggleElement?.length) {
    toggleElement[0].addEventListener("click", (event) => {
      event.preventDefault();
      const hiddenCommunitiesEl = document.querySelector(".hidden-communities");
      const hiddenCommunitiesArrowEl = document.querySelector(
        ".hidden-communities-title-arrow"
      );
      if (hiddenCommunitiesEl.classList.contains("kontextmark-hide")) {
        hiddenCommunitiesEl.classList.remove("kontextmark-hide");
        hiddenCommunitiesArrowEl.classList.remove("kontextmark-icon-down");
      } else {
        hiddenCommunitiesEl.classList.add("kontextmark-hide");
        hiddenCommunitiesArrowEl.classList.add("kontextmark-icon-down");
      }
    });
  }
};

const POPOVER = ({ kontextData, profilePage }) => {
  console.log("Preparing popover with kontextData:", kontextData);

  kontextData?.rankings.forEach(rankItem => {
    console.log(`Community: ${rankItem.community}, Rank: ${rankItem.rank}`);
  });

  chrome.runtime.sendMessage({
    name: "track_details_" + (profilePage ? "profile" : "hover"),
    body: {
      twitterScreenName: currentUsersHandle,
    },
  });
  const isDarkMode =
    document.body.style.backgroundColor !== "rgb(255, 255, 255)";

  const hiddenCommunities = kontextData?.rankings.filter((item) => item.hidden);
  const hiddenCommunitiesLength = hiddenCommunities?.length;

  const popoverHTML = `
  <div class="kontextCheckPopover ${profilePage ? "kontextProfilePage" : ""}">
    <table class="communities">
      <tbody>
      ${kontextData?.rankings
        .filter((item) => !item.hidden)
        ?.sort((a, b) => a.rank - b.rank)
        ?.map((item) => {
          const isBookmarked = loggedUserBookmarkedCommunities.has(
            item?.community
          );

          return `
            <tr class="communityWrapper">
            <td class="communityName">
            <a style="color: ${
              isDarkMode ? "#e7e9ea" : "#111"
            };">
              <span class="kontextmark-text-hash">#</span>${formatNumber(
                item?.rank
              )}
            </a>
            </td>
            <td class="communityIn">  
            <span class="kontextmark-text-in">in</span>
            </td>
            <td class="communitySvg">
              ${renderIcon({ filled: false, isBookmarked })}
            </td>
            <td>
            <span class="communityRank">
            <a style="color: ${
              isDarkMode ? "#e7e9ea" : "#111"
            };">
              ${handleToScreenName(
                item?.community
              )}
            </a>
            </span>
              </td>
              </tr>
          `;
        })
        .join("")}
      </tbody>
      ${
        hiddenCommunitiesLength
          ? `<tbody>
        <tr>
          <td></td>
          <td></td>
          <td>
          <div class="hidden-communities-title-arrow kontextmark-icon-down">
          ${UP_ARROW_SVG}
            </div>
          </td>
          <td>
            <div class="hidden-communities-title">
              Show ${hiddenCommunitiesLength} hidden
            </div>
          </td>
        </tr>
        </tbody>
        <tbody class="hidden-communities kontextmark-hide">
        ${hiddenCommunities
          ?.sort((a, b) => a.rank - b.rank)
          ?.map((item) => {
            const isBookmarked = loggedUserBookmarkedCommunities.has(
              item?.community
            );

            return `
            <tr class="communityWrapper hidden-communities">
            <td class="communityName">
            <a style="color: ${
              isDarkMode ? "#e7e9ea" : "#111"
            };" >
              <span class="kontextmark-text-hash">#</span>
                ${formatNumber(
                item?.rank
              )}
            </a>
            </td>
            <td class="communityIn">  
            <span class="kontextmark-text-in">in</span>
            </td>
            <td class="communitySvg">
              ${renderIcon({ filled: false, isBookmarked })}
            </td>
            <td>
            <span class="communityRank">
            <a style="color: ${
              isDarkMode ? "#e7e9ea" : "#111"
            };" >
              ${handleToScreenName(
                item?.community
              )}
            </a>
            </span>
            </td>
            </tr>
        `;
          })
          .join("")}
      </tbody>`
          : ""
      }
    </table>
  </div>`;

  console.log("Generated POPOVER HTML:", popoverHTML);
  return popoverHTML;
};

const PURPLE_CHECK_SVG = ({ handle, kontextData, isMessagesPage }) => {
  const bestRank = kontextData?.rankings?.reduce((prev, curr) => {
    return prev.rank < curr.rank ? prev : curr;
  })?.rank;

  const hasBookmarkedCommunity = kontextData.rankings.some((data) =>
    loggedUserBookmarkedCommunities.has(data.community)
  );

  const isDarkMode =
    document.body.style.backgroundColor !== "rgb(255, 255, 255)";

  if (kontextData) {
    return `
    <div>
      <div class="kontextCheck ${isDarkMode ? "kontextmark-darkMode" : ""} ${
      isMessagesPage ? "kontextmark-messagesPage" : ""
    }">
        <a>
          ${renderIcon({ filled: true, isBookmarked: hasBookmarkedCommunity })}
          <span class="kontextmark-bestRank">${formatNumber(bestRank)}</span>
        </a>
        ${
          isMessagesPage
            ? `<div class="kontextmark-custom-popup">${POPOVER({
                kontextData,
              })}</div>`
            : ""
        }
      </div>
    </div>`;
  }

  return ``;
};

// Filter blue check nodes and add to `blueCheckNodes` set
const makeUserHandlesNode = (node) => {
  const userNameItems = querySelectorAllIncludingMe(
    node,
    FEED_HANDLES_SELECTOR
  );
  const userNameItemsSsr = querySelectorAllIncludingMe(
    node,
    FEED_HANDLES_SELECTOR_SSR
  );
  const userNameItemsInDimMode = querySelectorAllIncludingMe(
    node,
    FEED_HANDLES_SELECTOR_DIM_MODE
  );
  const userNameItemsInDarkMode = querySelectorAllIncludingMe(
    node,
    FEED_HANDLES_SELECTOR_DARK_MODE
  );
  const hoverCardItems = querySelectorAllIncludingMe(node, HOVER_CARD_SELECTOR);

  for (const userNameItem of [
    ...userNameItems,
    ...userNameItemsSsr,
    ...userNameItemsInDarkMode,
    ...userNameItemsInDimMode,
  ]) {
    // const handle = handleToScreenName(userNameItem.innerText);
    userNameNodes.add(userNameItem);
  }

  for (const hoverCardItem of hoverCardItems) {
    hoverCardSet.add(hoverCardItem);
  }
};

// Adds kontext check next to names everywhere
const addPurpleCheck = async () => {
  for (const userNameNode of userNameNodes.values()) {
    try {
      if (userNameNode && userNameNode.childNodes[0] && userNameNode.childNodes[0].innerText
      // console.log("userNameNode", userNameNode);
      // if (
      //   userNameNode.childNodes.length < 2 &&
      //   userNameNode.childNodes[0].innerText?.length &&
      //   !/^[a-zA-Z0-9_]{1,15}$/.test(userNameNode.childNodes[0].innerText)
      ) {
        // Extract handle from node
        const rawHandle = userNameNode.innerText;
        const handle = handleToScreenName(rawHandle);

        const isAccountMenuSectionSelector =
          userNameNode?.parentElement?.parentElement?.parentElement
            ?.parentElement?.parentElement?.parentElement;
        const isAccountMenuSectionSelectorHasAttribute =
          isAccountMenuSectionSelector?.getAttribute("aria-label");
        const profilePageHeaderElement =
          userNameNode?.parentElement?.parentElement?.parentElement
            ?.parentElement?.parentElement?.parentElement &&
          userNameNode?.parentElement?.parentElement?.parentElement
            ?.parentElement?.parentElement?.parentElement;
        const isProfilePageHeader =
          profilePageHeaderElement?.getAttribute("data-testid") === "UserName";

        if (!isAccountMenuSectionSelectorHasAttribute) {
          if (handle) {
            if (!userTrackedSet.has(handle)) {
              userTrackedSet.add(handle);
            } else {
              const kontextDataForCurrentUser = userDataMap[handle];
              if (
                kontextDataForCurrentUser &&
                kontextDataForCurrentUser.rankings &&
                userNameNode?.innerHTML &&
                !isProfilePageHeader
              ) {
                userNameNode.style.flexDirection = "row";
                userNameNode.style.alignItems = "center";
                userNameNode.style.position = "relative";
                userNameNode.style.display = "flex";
                const isConversationList =
                  userNameNode?.parentElement?.parentElement?.parentElement
                    ?.parentElement?.parentElement?.parentElement?.parentElement
                    ?.parentElement?.parentElement?.parentElement?.parentElement
                    ?.parentElement?.parentElement;
                const isMessagesPage =
                  isConversationList?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.getAttribute(
                    "aria-label"
                  ) === "Timeline: Messages";
                if (isMessagesPage) {
                  if (
                    isConversationList &&
                    isConversationList.getAttribute("data-testid") ===
                      "conversation"
                  ) {
                    const elemToInsertHoverCard =
                      userNameNode?.parentElement?.parentElement?.parentElement
                        ?.parentElement?.parentElement?.parentElement
                        ?.parentElement?.parentElement?.parentElement;
                    if (elemToInsertHoverCard) {
                      const hasHoverCard = querySelectorAllIncludingMe(
                        elemToInsertHoverCard,
                        ".kontextCheck"
                      );
                      if (!hasHoverCard?.length) {
                        elemToInsertHoverCard.style.position = "relative";
                        elemToInsertHoverCard.style.top = "-2px";
                        elemToInsertHoverCard.innerHTML =
                          elemToInsertHoverCard.innerHTML +
                          PURPLE_CHECK_SVG({
                            handle,
                            kontextData: kontextDataForCurrentUser,
                            isMessagesPage,
                          });
                      }
                    }
                  }
                } else {
                  userNameNode.innerHTML =
                    PURPLE_CHECK_SVG({
                      handle,
                      kontextData: kontextDataForCurrentUser,
                      isMessagesPage,
                    }) + userNameNode.innerHTML;
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("Error adding purple check: ", e);
    }
  }
};

const addCommunitiesInHoverCard = () => {
  for (const hoverCardItem of hoverCardSet.values()) {
    try {
      if (!hoverCardItem.classList.contains("kontextFontInherit")) {
        hoverCardItem.style.color = "#536471";
        hoverCardItem.classList.add("kontextFontInherit");
      }
      const wrapperElement = hoverCardItem.parentElement.parentElement;
      const HANDLE_SELECTOR_IN_POPOVER = `span.css-901oao.css-16my406.r-poiln3.r-bcqeeo.r-qvutc0`;
      const hoverHandleElement = querySelectorAllIncludingMe(
        hoverCardItem,
        HANDLE_SELECTOR_IN_POPOVER
      );
      const rawHandle = hoverHandleElement?.filter((item) =>
        item.innerText.startsWith("@")
      )[0]?.innerText;
      const handle = handleToScreenName(rawHandle);

      const hidekontextCheckFromPopupHandle = () => {
        const hoverHandleElement = querySelectorAllIncludingMe(
          hoverCardItem,
          ".kontextCheck"
        );

        if (hoverHandleElement?.length) {
          hoverHandleElement[0].style.display = "none";
        }
      };

      // Remove regular Kontext Check from handles in popup
      hidekontextCheckFromPopupHandle();

      // Hide bookmarks in User switcher popup in bottom left
      const isInsideUserSwitcher =
        hoverCardItem?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement
          .getAttribute("aria-label")
          ?.includes("Switch to") ||
        hoverCardItem?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement
          .getAttribute("data-testid")
          ?.includes("UserCell");

      if (hoverHandleElement?.length) {
        const alreadyHasCommunities = wrapperElement
          ? querySelectorAllIncludingMe(wrapperElement, "div.kontextCheckPopover")
          : false;

        if (
          handle.length &&
          !/^[a-zA-Z0-9_]{1,15}$/.test(handle) &&
          !alreadyHasCommunities?.length
        ) {
          const kontextDataForCurrentUser = userDataMap[handle];
          if (
            kontextDataForCurrentUser &&
            kontextDataForCurrentUser.rankings &&
            wrapperElement?.innerHTML &&
            !isInsideUserSwitcher
          ) {
            hoverPopoverTrackedSet.add(handle);
            wrapperElement.innerHTML =
              wrapperElement.innerHTML +
              POPOVER({
                kontextData: kontextDataForCurrentUser,
              });
          }
        }
      }
    } catch (e) {
      console.log("error tracking hover card item", e);
    }
  }
};

const PROFILE_PAGE_COMMUNITIES = () => {
  // console.log("Generating communities HTML with userScore:", userScore);

  const handle = window.location.pathname.split("/")[1];
  const processedHandle = handleToScreenName(handle);
  const kontextDataForCurrentUser = userDataMap[processedHandle];

  if (kontextDataForCurrentUser && kontextDataForCurrentUser?.rankings?.length) {
    const popoverHTML = POPOVER({
      kontextData: kontextDataForCurrentUser,
      profilePage: true,
    });
    console.log("Generated PROFILE_PAGE_COMMUNITIES HTML:", popoverHTML);
    return popoverHTML;
  }
  return "";
};

let profilePageCommunitiesAdded = false;
let currentProfileHandle = null;
let debounceTimeout;

const addCommunitiesInProfilePage = async () => {
  console.log("Checking profile page handle...");
  const profilePageHandle = document.querySelector(PROFILE_PAGE_SELECTOR);
  
  if (profilePageHandle) {
    console.log("Profile page handle found.");
    const handle = window.location.pathname.split("/")[1];
    const processedHandle = handleToScreenName(handle);

    if (!userTrackedSet.has(processedHandle)) {
      console.log(`Handle ${processedHandle} not in tracked set, adding now.`);
      userTrackedSet.add(processedHandle);
      currentProfileHandle = processedHandle;
      profilePageCommunitiesAdded = false;
    }

    // Prevent further execution if communities are already added
    if (profilePageCommunitiesAdded) {
      console.log("Communities already added to profile page, skipping.");
      return;
    }

    console.log("Checking for existing communities in profile page...");
    const alreadyHasCommunities = querySelectorAllIncludingMe(
      profilePageHandle,
      ".kontextCheckPopover.kontextProfilePage"
    );

    if (alreadyHasCommunities?.length) {
      console.log("Communities already present, updating content.");
      alreadyHasCommunities[0].innerHTML = PROFILE_PAGE_COMMUNITIES();
      profilePageCommunitiesAdded = true;
    } else {
      console.log("No communities found, attempting to insert.");
      const insertInElement = querySelectorAllIncludingMe(
        profilePageHandle,
        ".css-175oi2r.r-18u37iz.r-1w6e6rj.r-6gpygo.r-14gqq1x"
      );

      if (insertInElement?.length && userDataMap[processedHandle]) {
        console.log("Insertion point found, adding communities...");
        insertInElement[0].innerHTML += PROFILE_PAGE_COMMUNITIES();
        insertInElement[0].classList.add("kontextCommunitiesInserted");
        profilePageCommunitiesAdded = true;
        console.log("Communities added to profile page.");
      } else {
        console.log("No valid insertion point found, or no user data available.");
      }
    }
  } else {
    console.log("Profile page handle not found, cannot add communities.");
  }
};

const debouncedAddCommunitiesInProfilePage = () => {
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    addCommunitiesInProfilePage();
  }, 300);
};

let bookmarkPromise = null;
const storeBookmarks = (twitterId) => {
  if (!bookmarkPromise) {
    bookmarkPromise = new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { name: "getBookmarks", twitterId },
        (bookmarks) => {
          if (bookmarks?.length) {
            bookmarks?.forEach((item) =>
              loggedUserBookmarkedCommunities.add(item)
            );
            resolve();
          }
        }
      );
    });
  }
  return bookmarkPromise;
};

const getCurrentUserAndBookmarks = (node) => {
  const userNameItems = querySelectorAllIncludingMe(
    node,
    `[aria-label="Profile"]`
  );

  if (
    userNameItems?.length &&
    userNameItems[0]?.getAttribute("href")?.startsWith("/") &&
    !loggedUserBookmarkedCommunities?.size
  ) {
    currentUsersHandle = userNameItems[0]?.getAttribute("href")?.slice(1);
    
    chrome.runtime.sendMessage(
      { name: "getUserData", handle: currentUsersHandle },
      (data) => {
        if (data && !data.err) {
          const { twitterId, rankings } = data;
          storeBookmarks(twitterId).then(() => {
            debouncedAddCommunitiesInProfilePage();
          });
        } else {
          console.error('Error fetching user data:', data.err);
        }
      }
    );
  }
  chrome.runtime.sendMessage({
    name: "track_use_last_1h",
    body: {
      twitterScreenName: currentUsersHandle,
    },
  });
};

const updateUsersData = async () => {
  const promises = Array.from(userTrackedSet).map((item) => {
    const screenName = item;
    if (!userDataMap[screenName]) {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { name: "getUserData", handle: screenName },
          (userData) => {
            console.log(`Received userData for ${screenName}:`, userData);
            if (userData?.rankings) {
              userDataMap[screenName] = userData;
            }
            resolve();
          }
        );
      });
    }
  });

  await Promise.allSettled(promises);
  console.log("Updated userDataMap:", userDataMap);
};

const addCommunityProposalDiv = (observer) => {
  const badgePlusSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-badge-plus">
      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 a4 a0 a1 a0-6.76Z"/>
      <line x1="12" x2="12" y1="8" y2="16"/>
      <line x1="8" x2="16" y1="12" y2="12"/>
    </svg>
  `;

   const parentDivs = document.querySelectorAll(
    '.css-175oi2r.r-1kbdv8c.r-18u37iz.r-1wtj0ep.r-1ye8kvj.r-1s2bzr4'
   );

   if (parentDivs.length > 0) {
     console.log("Parent divs found, adding the new div to each.");

     parentDivs.forEach(parentDiv => {
       const existingDiv = parentDiv.querySelector(
         '.css-175oi2r.r-18u37iz.r-1h0z5md.r-13awgt0.communityButton'
       );

       if (!existingDiv) {
         observer.disconnect();

         const newDiv = document.createElement('div');
         newDiv.className = 'css-175oi2r r-18u37iz r-1h0z5md r-13awgt0 communityButton';
         newDiv.innerHTML = badgePlusSVG;

         parentDiv.appendChild(newDiv);
         console.log("New div added inside a parent div.");

         newDiv.addEventListener('click', async (event) => {
          event.stopPropagation();
          let contentDiv = parentDiv.nextElementSibling;
        
          if (contentDiv && contentDiv.classList.contains('example-content')) {
            contentDiv.style.display = contentDiv.style.display === 'none' ? 'block' : 'none';
          } else {
            contentDiv = document.createElement('div');
            contentDiv.className = 'example-content';
        
            chrome.runtime.sendMessage({ name: 'getAllCommunityLists' }, (response) => {
              if (response.err) {
                console.error(response.err);
              } else {
                const lists = response.lists || [];
                const listItems = lists.map(title => `
                  <li>
                    ${title} 
                    <button class="propose-button" data-title="${title}">Propose</button>
                  </li>
                `).join('');
                contentDiv.innerHTML = `
                  <p>Propose adding this tweet's author to a Kontext community list:</p>
                  <ul>${listItems}</ul>
                `;
        
                // Add event listener for propose buttons
                contentDiv.querySelectorAll('.propose-button').forEach((button, index) => {
                  button.addEventListener('click', () => {
                    const listTitle = button.getAttribute('data-title');
                    console.log(`Propose button clicked for ${listTitle}`);
        
                    // Ensure we are getting the userHandle and proposedAccountId correctly
                    const accountMenuButton = document.querySelector('[aria-label="Account menu"]');
                    const userHandleElement = accountMenuButton.querySelector('.css-175oi2r.r-1awozwy.r-18u37iz.r-1wbh5a2 span');
        
                    if (userHandleElement) {
                      const userHandle = userHandleElement.textContent.trim();
        
                      // Find the correct ancestor for proposedAccountId
                      const correctParent = parentDiv.closest('.css-175oi2r.r-1iusvr4.r-16y2uox.r-1777fci.r-kzbkwu');
              
                      // Now find the span with the class "css-1jxf684" within the correctParent
                      const accountIdElement = correctParent.querySelector('.css-146c3p1.r-dnmrzs.r-1udh08x.r-3s2u2q.r-bcqeeo.r-1ttztb7.r-qvutc0.r-37j5jr.r-a023e6.r-rjixqe.r-16dba41.r-18u37iz.r-1wvb978');
                      const proposedAccountId = accountIdElement ? accountIdElement.textContent.trim() : '';

                      // Check if we have both listTitle and proposedAccountId
                      if (!listTitle || !proposedAccountId) {
                        console.error('Missing data for proposal:', {
                          listTitle,
                          proposedAccountId,
                        });
                        return;
                      }
        
                      const messageData = {
                        name: 'createProposal',
                        curationListName: listTitle,  // Ensure listTitle is passed correctly
                        proposedAccountId,            // Ensure proposedAccountId is passed correctly
                        proposers: [userHandle],
                      };
                      console.log('Sending message:', messageData);  // Added log
        
                      // Send the message to create the proposal
                      chrome.runtime.sendMessage(messageData, (response) => {
                        if (response.err) {
                          console.error(response.err);
                        } else {
                          console.log('Proposal created:', response);
                        }
                      });
                    } else {
                      console.error('User handle element not found.');
                    }
                  });
                });
              }
            });
        
            parentDiv.insertAdjacentElement('afterend', contentDiv);
            console.log("Example content div added below the parent div.");
          }
        });
        

         observer.observe(document.body, {
           childList: true,
           subtree: true,
         });
       } else {
         console.log("Div already exists in this parent, skipping addition.");
       }
     });
   } else {
     console.log("No parent divs found.");
   }
};

const main = () => {
  const observer = new MutationObserver(async (mutations) => {
    
    try {
      console.log("Mutation observed:", mutations);
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          console.log("Handling childList mutation:", mutation);
          addCommunityProposalDiv(observer);
          if (mutation.target.classList.contains("kontextCommunitiesInserted")) {
            continue;
          }
          getCurrentUserAndBookmarks(mutation.target);
          makeUserHandlesNode(mutation.target);
        }

        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) {
            console.log("Node added:", node);
            addCommunityProposalDiv(observer);
            if (node.classList.contains("kontextCommunitiesInserted")) {
              continue;
            }
            makeUserHandlesNode(node);
            addHiddenCommunitiesToggleEvent(node);
          }
        }
      }

      await updateUsersData();
      addPurpleCheck();
      addCommunitiesInHoverCard();
      addCommunitiesInProfilePage();
    } catch (e) {
      console.error("Cannot observe mutations: ", e);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
};

main();
