import { Form, ActionPanel, Action, showToast, Icon, getSelectedText, Toast, showHUD, popToRoot } from "@raycast/api";
import { runAppleScript } from "@raycast/utils";
import { useState, useEffect } from "react";
import fetch from "node-fetch";
import { Bookmark, addBookmark } from "./api";
import he from "he";

export default function Command() {
  const [state, setState] = useState<{ url: string; title: string; description: string }>({
    url: "",
    title: "",
    description: "",
  });

  useEffect(() => {
    (async () => {
      var pageUrl;
      try {
        const selectedText = await getSelectedText();
        console.log("selectedText", selectedText);
        if (!isValidURL(selectedText)) {
          throw new Error(selectedText + " is not a valid URL");
        }
        pageUrl = selectedText;
      } catch (error) {
        const output = await runAppleScript(
          `
tell application "System Events" to set frontApp to name of first process whose frontmost is true
if (frontApp = "Safari") or (frontApp = "Webkit") then
  using terms from application "Safari"
    tell application frontApp to set currentTabUrl to URL of front document
  end using terms from
else if (frontApp = "Brave Browser") or (frontApp = "Google Chrome") then
  using terms from application "Google Chrome"
    tell application frontApp to set currentTabUrl to URL of active tab of front window
  end using terms from
else
  return "ERROR"
end if
return currentTabUrl
`
        );
        if (output == "ERROR") {
            console.log("Couldn't determine URL of front-most application")
            return
        }
        pageUrl = output;
      }
      try {
        const document = await loadDocument(pageUrl);
        const documentTitle = await extractDocumentTitle(document);
        const documentDescription = await extractPageDescription(document);
        setState((oldState) => ({
          ...oldState,
          url: pageUrl,
          title: documentTitle,
          description: documentDescription,
        }));
      } catch (error) {
        console.error("Could not load document title", error);
        setState((oldState) => ({ ...oldState, url: pageUrl }));
      }
    })();
  }, []);

  async function handleSubmit(values: Bookmark) {
    console.log("bookmark", values);
    const url = values.url.trim();
    const title = values.title.trim();
    if (!isValidURL(url) || title.length === 0) {
      showToast({
        title: "Enter a valid URL and title for the bookmark",
        style: Toast.Style.Failure,
      });
      return;
    }
    const toast = await showToast({
      title: "Pinning bookmark...",
      style: Toast.Style.Animated,
    });
    try {
      await addBookmark(values);
      toast.hide();
      showHUD("Bookmark pinned!");
      popToRoot();
    } catch (error) {
      console.error("addBookmark error", error);
      showToast({
        title: "Could not pin bookmark",
        message: String(error),
        style: Toast.Style.Failure,
      });
    }
  }

  function handleURLChange(value: string) {
    setState((oldState) => ({ ...oldState, url: value }));
  }

  function handleTitleChange(value: string) {
    setState((oldState) => ({ ...oldState, title: value }));
  }

  function handleDescriptionChange(value: string) {
    setState((oldState) => ({ ...oldState, description: value }));
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Add Bookmark" icon={{ source: Icon.Plus }} onSubmit={handleSubmit} />
          <Action.OpenInBrowser title="Open Pinboard" url="https://pinboard.in" />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="url"
        title="URL"
        placeholder="Enter URL (Tip: Select a URL before opening this form)"
        value={state.url}
        onChange={handleURLChange}
      />
      <Form.TextField
        id="title"
        title="Title"
        placeholder="Enter title"
        value={state.title}
        onChange={handleTitleChange}
      />
      <Form.Separator />
      <Form.TextArea
        id="description"
        title="Description"
        placeholder="Enter bookmark description"
        value={state.description}
        onChange={handleDescriptionChange}
      />
      <Form.TextField id="tags" title="Tags" placeholder="Enter tags (comma-separated)" />
      <Form.Checkbox id="private" title="" label="Private" storeValue />
      <Form.Checkbox id="readLater" title="" label="Read Later" storeValue />
    </Form>
  );
}

async function loadDocument(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    return Promise.reject(response.statusText);
  }
  return await response.text();
}

function extractDocumentTitle(document: string): string {
  const title = document.match(/<title>(.*?)<\/title>/)?.[1] ?? "";
  return he.decode(title);
}

function extractPageDescription(document: string): string {
  const description = document.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i)?.[1] ?? "";
  return he.decode(description);
}

function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
}
