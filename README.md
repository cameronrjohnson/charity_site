# Charity Finder

A static charity-finding website using HTML, CSS, JavaScript modules, and Supabase for authentication and user data. No build step or React setup is currently required.

## Project Layout

| Location | Purpose |
| --- | --- |
| [index.html](index.html) | Homepage; stays at the root for GitHub Pages. |
| [pages/](pages/) | Charity directory and profiles, quiz pages, account pages, and the AI chat. |
| [css/](css/) | Shared styles. |
| [js/](js/) | Browser modules for authentication, profiles, charity data, and community features. |
| [assets/](assets/) | Local images and other media when needed. |
| [data/](data/) | Static data files when needed, never private user data or secrets. |
| [supabase/](supabase/) | Database configuration, migrations, and SQL tests. |
| [tests/](tests/) | JavaScript tests. |
| [PROJECT_PROPOSAL.md](PROJECT_PROPOSAL.md) | Project goals, schedule, and detailed Supabase setup. |

## Run Locally

From the project root:

```powershell
python -m http.server 8765
```

Open http://localhost:8765/. Serve over HTTP rather than opening HTML files directly, because the site uses JavaScript modules.

GitHub Pages can serve this same project root without a build step. Secondary page URLs now start with `pages/`; update any external links or bookmarks that used the old root-level page URLs.

## Tests

From the project root:

```powershell
node --experimental-vm-modules --test tests/*.test.mjs
```

This runs data-access, account-navigation, and chat-engine tests. Navigation tests include deployment under a GitHub Pages project subfolder. Chat tests use a mocked inference engine to exercise streaming, context, validation, stopping, and recovery without downloading a model. Database setup and SQL test instructions are in [the proposal](PROJECT_PROPOSAL.md#user-data-setup).

## Adding Features

Keep secondary HTML pages in [pages/](pages/), browser behavior in [js/](js/), and shared styles in [css/](css/). Pages use `../css/` and `../js/` to load shared files, `../index.html` to return home, and sibling filenames to link to other pages.

## Free AI Chat

Choose **AI chat** on any site page to open the assistant in a popup without leaving that page, then choose **Start free assistant**. [The full chat page](pages/chat.html) remains available as a fallback. No API key, account, paid AI service, or database change is needed. It also works on GitHub Pages.

The popup reuses the chat page in an embedded frame. Closing it with the close button, launcher, or Escape preserves its conversation and loaded model for that page visit. Navigating to another page or refreshing still clears the conversation; cached model files can be reused.

Before each question, the popup obtains a fresh, bounded summary of the current public page so references such as "this charity" have context. Only allowlisted public headings, charity descriptions, and quiz text are included. Account details, saved charities, comments, form inputs, and URL parameters are excluded. The quiz remains a static prototype; the assistant does not infer nonexistent saved answers. Parent/frame messages are restricted to the same origin and the expected source window.

- [WebLLM](https://webllm.mlc.ai/) 0.2.83 runs Llama 3.2 1B Instruct in a module worker so inference does not block the interface. Built with Llama; the model is subject to the [Llama 3.2 Community License](https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f32_1-MLC/blob/main/LICENSE).
- Visitors need a WebGPU-compatible browser and GPU, roughly 1.2 GB of available GPU memory, and HTTPS or localhost. Recent desktop Chrome or Edge with hardware acceleration enabled is recommended; not every phone or computer supports it.
- Starting downloads approximately 700 MB of model files from Hugging Face, plus runtime files from public CDNs/GitHub. Initial loading can take several minutes; browser caching may avoid later downloads. Network/data charges and device resource use still apply. The model is not downloaded just by opening the page.
- Chat prompts are processed locally, not sent to an AI provider or Supabase. Model/CDN hosts still receive normal download requests. The conversation exists only in tab memory; refreshing or leaving clears it. Cached model files can be removed through the browser's site-data settings.
- The assistant has background facts about the three directory charities, not live web access or verified financial data. Its small local model can make mistakes. Model output is plain text, never HTML. The interface keeps only chat controls and a compact model attribution; page context is supplied in the background without an extra header or charity-link footer.
- Each message is limited to 400 characters and each answer to 256 generated tokens. The model receives the latest two completed exchanges; **New conversation** clears history, and **Stop response** interrupts generation.

[js/chat-engine.js](js/chat-engine.js) owns model loading and conversation limits; [js/chat-worker.js](js/chat-worker.js) runs WebLLM; [js/chat.js](js/chat.js) connects the page controls. [js/chat-widget.js](js/chat-widget.js) opens the popup and [js/chat-context.js](js/chat-context.js) selects its public page context. Keep the WebLLM version identical in the engine and worker.

If the browser cannot run WebGPU, the page reports that limitation and keeps the charity directory accessible. There is deliberately no silent paid-API fallback. Any future hosted AI provider secret must stay in a backend such as a Supabase Edge Function, never in browser JavaScript or this public repository.