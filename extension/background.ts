import superjson from 'superjson';

const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/api/'
      fetch(url, options) {
        return fetch(url, {
          ...options,
        });
      },
    }),
  ],
  transformer: superjson,
});

declare const chrome: any;
interface TwitterProfileData {
  events?: Array<{
    rankings?: Array<{ community: string; hidden?: boolean }>;
    twitter_id?: string;
  }>;
}

interface Message {
  name: string;
  handle?: string;
  twitterId?: string;
  body?: any;
  curationListName?: number;
  proposedAccountId?: string;
  proposers?: string[];
}

interface Response {
  bookmarks?: any[];
  err?: Error;
}

const MANIFEST = chrome.runtime.getManifest();

let sessionId: string | null = null;
let lastTwitterScreenName: string | null = null;
let lastUsePingTime: number | null = null;
const getSessionId = () => {
  if (!sessionId) {
    sessionId = crypto.randomUUID();
  }
  return sessionId;
};

interface TrackParamObj {
  twitterScreenName?: string;
  [key: string]: any;
}

interface ScreenNameParam {
  screenName: string;
}

const track = (event: string, paramObj: TrackParamObj) => {
  if (paramObj.twitterScreenName && paramObj.twitterScreenName !== lastTwitterScreenName) {
    lastTwitterScreenName = paramObj.twitterScreenName;
    setUninstallURL();
  }
  const body = {
    ...paramObj,
    manifest_version: MANIFEST.version,
    sessionId: getSessionId(),
    event,
  };
  console.log("User ping", event, body);

  interface StorageResult {
    events: any[];
  }
  chrome.storage.local.get({ events: [] }, (result: StorageResult) => {
    const events = [...result.events, body];
    chrome.storage.local.set({events}, () => {
      console.log("Event tracked locally", event, body);
    });
  });
};

chrome.runtime.onMessage.addListener(
  (
    msg: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void
  ) => {
    console.log('Message received in background script:', msg);
    if (msg.name === 'getUserData' && msg.handle) {
      Promise.all([
        accounts.getUser.query({ username: msg.handle })
      ])
      .then(([data]) => {
        console.log('Fetched user data for:', msg.handle);
        sendResponse({ twitterId: data.twitterId, rankings: data.rankings });
      })
      .catch((err) => sendResponse({ err: err.message }));
    } else if (msg.name === 'getTwitterUserId' && msg.handle) {
      accounts.getTwitterUser
        .query({ username: msg.handle })
        .then((userId) => {
          console.log('Fetched Twitter user ID for:', msg.handle);
          sendResponse(userId);
        })
        .catch((err) => sendResponse({ err: err.message }));
    } else if (msg.name === 'createProposal') {
      proposals.proposal.mutate({
          curationListName: msg.curationListName,
          proposedAccountId: msg.proposedAccountId,
          proposers: msg.proposers,
      })
      .then((proposal) => sendResponse({ proposal }))
      .catch((err) => sendResponse({ err: err.message }));
      return true; // Keep the message channel open for async response
    } else if (msg.name === 'getAllCommunityLists') {
      accounts.getAllListTitles.query()
            .then((titles) => sendResponse({ lists: titles }))
            .catch((err) => sendResponse({ err: err.message }));
        return true;
    } else if (msg.name.startsWith('track_')) {
      const event = msg.name.slice(6);
      track(event, msg.body);
    }
    return true;
  }
);

chrome.runtime.onInstalled.addListener(async (details: chrome.runtime.InstalledDetails) => {
  for (const cs of MANIFEST.content_scripts) {
    for (const tab of await chrome.tabs.query({ url: cs.matches })) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: cs.js,
      });
    }
    track("ext_" + details.reason, {});
  }
});

