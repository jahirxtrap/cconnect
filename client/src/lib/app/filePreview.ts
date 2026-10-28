import { settings } from "$lib/data/settings.svelte";
import { layout } from "$lib/platform/layout.svelte";
import { panes } from "$lib/screens/chat/panes.svelte";
import { navigation, type PreviewRequest } from "./navigation.svelte";

export const openFilePreview = (request: PreviewRequest) => {
  if (layout.mobile || settings.chatViewFull || !panes.previewFits || navigation.route !== "/") {
    panes.closePreview();
    navigation.openPreview(request);
    return;
  }
  navigation.preview = request;
  navigation.previewPane = true;
  panes.showPreview();
};

export const closeFilePreview = () => {
  if (navigation.previewPane) {
    navigation.endPreview();
    panes.closePreview();
    return;
  }
  navigation.closePreview();
};

export const expandFilePreview = () => {
  const request = navigation.preview;
  if (!request || !navigation.previewPane) return;
  navigation.previewPane = false;
  panes.closePreview();
  navigation.openPreview(request);
};
