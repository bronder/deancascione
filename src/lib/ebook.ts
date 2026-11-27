// Shared e-book constants and the signup call, used by the LeadMagnet
// section and the slide-in offer so both stay in sync.

// Download links point at GitHub Release assets: the ~120MB bundle exceeds
// GitHub's 100MB per-file commit limit and the old host's /ebook/ folder was
// orphaned when the docroot moved to /new (release assets keep the repo light
// and survive host changes). The original Audio_files.rar was a 0-byte file,
// so the MP3s were re-bundled as a ZIP. To update the files, upload new
// assets to a new release tag and repoint these URLs.
export const EBOOK_URL =
  'https://github.com/bronder/deancascione/releases/download/ebook-assets-v1/The-Neoclassic-Approach-to-Shred-Guitar.pdf';
export const AUDIO_URL =
  'https://github.com/bronder/deancascione/releases/download/ebook-assets-v1/Audio_files.zip';

// Web3Forms access key (public by design; submissions go to Dean's inbox).
export const WEB3FORMS_KEY = 'e617e835-6952-45e7-8042-2927b85efd93';

export const UNLOCK_KEY = 'dc-ebook-unlocked';
export const UNLOCK_EVENT = 'ebook:unlocked';

export const isUnlocked = () => {
  try {
    return localStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
};

// Send the signup, then mark the book unlocked everywhere on the page. A
// network failure never blocks the download.
export async function signup(form: HTMLFormElement) {
  try {
    await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(UNLOCK_KEY, '1');
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new CustomEvent(UNLOCK_EVENT));
}
