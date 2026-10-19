# Credits — THSC Queue Board

**THSC Queue Board** is the patient queuing system of **The Heart Specialists Clinic (THSC)**: front desk and Concierge, stations, the lobby TV with spoken announcements, QR queue numbers and the patient's phone page.

- **Made for:** The Heart Specialists Clinic. The clinic's name, logo (`public/theheartspecialists.png`) and texts belong to the clinic.
- **Built by:** the clinic's staff with [Claude Code](https://claude.com/claude-code) (Anthropic). Source code: [thscangeles-ph/QUEUEING-SYSTEM](https://github.com/thscangeles-ph/QUEUEING-SYSTEM).
- **Fonts and voices:** the board uses the computer's own fonts (Aptos, Segoe UI) and speech voices; none are included.

## Open-source software

THSC Queue Board is built on the open-source software below. Thank you to its authors. The full license text of each is in the [licenses](licenses/) folder.

### Inside the Queue Board file (`public/thsc-queue-board.html`)

| Software | Version | License | Author | Used for | License text |
| --- | --- | --- | --- | --- | --- |
| SheetJS Community Edition (xlsx) | 0.18.5 | Apache-2.0 | SheetJS LLC | Excel report (Download report) | [xlsx@0.18.5.txt](licenses/xlsx@0.18.5.txt) |

### Website and server (main parts)

| Software | Version | License | Author | Used for | License text |
| --- | --- | --- | --- | --- | --- |
| class-variance-authority | 0.7.1 | Apache-2.0 | Joe Bell | Button and badge styles | [class-variance-authority@0.7.1.txt](licenses/class-variance-authority@0.7.1.txt) |
| clsx | 2.1.1 | MIT | Luke Edwards | Combining style classes | [clsx@2.1.1.txt](licenses/clsx@2.1.1.txt) |
| lucide-react | 1.44.0 | ISC | Eric Fennis | Icons | [lucide-react@1.44.0.txt](licenses/lucide-react@1.44.0.txt) |
| next | 16.3.4 | MIT | Vercel | Website and server framework | [next@16.3.4.txt](licenses/next@16.3.4.txt) |
| qrcode | 1.5.4 | MIT | Ryan Day | QR code on the check-in poster | [qrcode@1.5.4.txt](licenses/qrcode@1.5.4.txt) |
| radix-ui | 1.6.7 | MIT | WorkOS | Building blocks of the website's buttons | [radix-ui@1.6.7.txt](licenses/radix-ui@1.6.7.txt) |
| react | 19.2.6 | MIT | Meta Platforms, Inc. and affiliates | Building the website pages | [react@19.2.6.txt](licenses/react@19.2.6.txt) |
| react-dom | 19.2.6 | MIT | Meta Platforms, Inc. and affiliates | Showing the website pages in the browser | [react-dom@19.2.6.txt](licenses/react-dom@19.2.6.txt) |
| tailwind-merge | 3.6.0 | MIT | Dany Castillo | Combining style classes | [tailwind-merge@3.6.0.txt](licenses/tailwind-merge@3.6.0.txt) |
| Tailwind CSS | 4.2.1 | MIT | Tailwind Labs | Styles of the website pages | [tailwindcss@4.2.1.txt](licenses/tailwindcss@4.2.1.txt) |
| shadcn/ui | 4.13.0 | MIT | shadcn | Base styles of the website's buttons and form fields | [shadcn-ui@4.13.0.txt](licenses/shadcn-ui@4.13.0.txt) |

### Ready-to-run server package (`THSC-Queue-Server.zip`)

| Software | Version | License | Author | Used for | License text |
| --- | --- | --- | --- | --- | --- |
| Node.js | v24.21.0 | MIT (with the licenses of its own bundled parts in the same file) | OpenJS Foundation and Node.js contributors | Runs the clinic server on Windows | [node@v24.21.0.txt](licenses/node@v24.21.0.txt) |

### All packages installed with the website

Everything `pnpm` installs for the website, including the packages above, the parts they depend on, and tools used only while building it (some are not included in what runs at the clinic).

| Package | Version | License | Author | License text |
| --- | --- | --- | --- | --- |
| @babel/code-frame | 7.29.7 | MIT | The Babel Team | [@babel__code-frame@7.29.7.txt](licenses/@babel__code-frame@7.29.7.txt) |
| @babel/compat-data | 7.29.7 | MIT | The Babel Team | [@babel__compat-data@7.29.7.txt](licenses/@babel__compat-data@7.29.7.txt) |
| @babel/core | 7.29.7 | MIT | The Babel Team | [@babel__core@7.29.7.txt](licenses/@babel__core@7.29.7.txt) |
| @babel/generator | 7.29.8 | MIT | The Babel Team | [@babel__generator@7.29.8.txt](licenses/@babel__generator@7.29.8.txt) |
| @babel/helper-compilation-targets | 7.29.7 | MIT | The Babel Team | [@babel__helper-compilation-targets@7.29.7.txt](licenses/@babel__helper-compilation-targets@7.29.7.txt) |
| @babel/helper-globals | 7.29.7 | MIT | The Babel Team | [@babel__helper-globals@7.29.7.txt](licenses/@babel__helper-globals@7.29.7.txt) |
| @babel/helper-module-imports | 7.29.7 | MIT | The Babel Team | [@babel__helper-module-imports@7.29.7.txt](licenses/@babel__helper-module-imports@7.29.7.txt) |
| @babel/helper-module-transforms | 7.29.7 | MIT | The Babel Team | [@babel__helper-module-transforms@7.29.7.txt](licenses/@babel__helper-module-transforms@7.29.7.txt) |
| @babel/helper-string-parser | 7.29.7 | MIT | The Babel Team | [@babel__helper-string-parser@7.29.7.txt](licenses/@babel__helper-string-parser@7.29.7.txt) |
| @babel/helper-validator-identifier | 7.29.7 | MIT | The Babel Team | [@babel__helper-validator-identifier@7.29.7.txt](licenses/@babel__helper-validator-identifier@7.29.7.txt) |
| @babel/helper-validator-option | 7.29.7 | MIT | The Babel Team | [@babel__helper-validator-option@7.29.7.txt](licenses/@babel__helper-validator-option@7.29.7.txt) |
| @babel/helpers | 7.29.7 | MIT | The Babel Team | [@babel__helpers@7.29.7.txt](licenses/@babel__helpers@7.29.7.txt) |
| @babel/parser | 7.29.8 | MIT | The Babel Team | [@babel__parser@7.29.8.txt](licenses/@babel__parser@7.29.8.txt) |
| @babel/template | 7.29.7 | MIT | The Babel Team | [@babel__template@7.29.7.txt](licenses/@babel__template@7.29.7.txt) |
| @babel/traverse | 7.29.8 | MIT | The Babel Team | [@babel__traverse@7.29.8.txt](licenses/@babel__traverse@7.29.8.txt) |
| @babel/types | 7.29.8 | MIT | The Babel Team | [@babel__types@7.29.8.txt](licenses/@babel__types@7.29.8.txt) |
| @floating-ui/core | 1.8.0 | MIT | atomiks | [@floating-ui__core@1.8.0.txt](licenses/@floating-ui__core@1.8.0.txt) |
| @floating-ui/dom | 1.8.0 | MIT | atomiks | [@floating-ui__dom@1.8.0.txt](licenses/@floating-ui__dom@1.8.0.txt) |
| @floating-ui/react-dom | 2.1.9 | MIT | atomiks | [@floating-ui__react-dom@2.1.9.txt](licenses/@floating-ui__react-dom@2.1.9.txt) |
| @floating-ui/utils | 0.2.12 | MIT | atomiks | [@floating-ui__utils@0.2.12.txt](licenses/@floating-ui__utils@0.2.12.txt) |
| @img/colour | 1.1.0 | MIT | — | [@img__colour@1.1.0.txt](licenses/@img__colour@1.1.0.txt) |
| @img/sharp-libvips-linux-x64 | 1.3.3 | LGPL-3.0-or-later | Lovell Fuller | [@img__sharp-libvips-linux-x64@1.3.3.txt](licenses/@img__sharp-libvips-linux-x64@1.3.3.txt) |
| @img/sharp-linux-x64 | 0.35.4 | Apache-2.0 | Lovell Fuller | [@img__sharp-linux-x64@0.35.4.txt](licenses/@img__sharp-linux-x64@0.35.4.txt) |
| @jridgewell/gen-mapping | 0.3.13 | MIT | Justin Ridgewell | [@jridgewell__gen-mapping@0.3.13.txt](licenses/@jridgewell__gen-mapping@0.3.13.txt) |
| @jridgewell/remapping | 2.3.5 | MIT | Justin Ridgewell | [@jridgewell__remapping@2.3.5.txt](licenses/@jridgewell__remapping@2.3.5.txt) |
| @jridgewell/resolve-uri | 3.1.2 | MIT | Justin Ridgewell | [@jridgewell__resolve-uri@3.1.2.txt](licenses/@jridgewell__resolve-uri@3.1.2.txt) |
| @jridgewell/sourcemap-codec | 1.6.0 | MIT | Justin Ridgewell | [@jridgewell__sourcemap-codec@1.6.0.txt](licenses/@jridgewell__sourcemap-codec@1.6.0.txt) |
| @jridgewell/trace-mapping | 0.3.31 | MIT | Justin Ridgewell | [@jridgewell__trace-mapping@0.3.31.txt](licenses/@jridgewell__trace-mapping@0.3.31.txt) |
| @next/env | 16.3.4 | MIT | Next.js Team | [@next__env@16.3.4.txt](licenses/@next__env@16.3.4.txt) |
| @next/swc-linux-x64-gnu | 16.3.4 | MIT | — | [@next__swc-linux-x64-gnu@16.3.4.txt](licenses/@next__swc-linux-x64-gnu@16.3.4.txt) |
| @radix-ui/number | 1.1.3 | MIT | — | [@radix-ui__number@1.1.3.txt](licenses/@radix-ui__number@1.1.3.txt) |
| @radix-ui/primitive | 1.1.7 | MIT | — | [@radix-ui__primitive@1.1.7.txt](licenses/@radix-ui__primitive@1.1.7.txt) |
| @radix-ui/react-accessible-icon | 1.1.15 | MIT | — | [@radix-ui__react-accessible-icon@1.1.15.txt](licenses/@radix-ui__react-accessible-icon@1.1.15.txt) |
| @radix-ui/react-accordion | 1.2.20 | MIT | — | [@radix-ui__react-accordion@1.2.20.txt](licenses/@radix-ui__react-accordion@1.2.20.txt) |
| @radix-ui/react-alert-dialog | 1.1.23 | MIT | — | [@radix-ui__react-alert-dialog@1.1.23.txt](licenses/@radix-ui__react-alert-dialog@1.1.23.txt) |
| @radix-ui/react-arrow | 1.1.15 | MIT | — | [@radix-ui__react-arrow@1.1.15.txt](licenses/@radix-ui__react-arrow@1.1.15.txt) |
| @radix-ui/react-aspect-ratio | 1.1.15 | MIT | — | [@radix-ui__react-aspect-ratio@1.1.15.txt](licenses/@radix-ui__react-aspect-ratio@1.1.15.txt) |
| @radix-ui/react-avatar | 1.2.6 | MIT | — | [@radix-ui__react-avatar@1.2.6.txt](licenses/@radix-ui__react-avatar@1.2.6.txt) |
| @radix-ui/react-checkbox | 1.3.11 | MIT | — | [@radix-ui__react-checkbox@1.3.11.txt](licenses/@radix-ui__react-checkbox@1.3.11.txt) |
| @radix-ui/react-collapsible | 1.1.20 | MIT | — | [@radix-ui__react-collapsible@1.1.20.txt](licenses/@radix-ui__react-collapsible@1.1.20.txt) |
| @radix-ui/react-collection | 1.1.15 | MIT | — | [@radix-ui__react-collection@1.1.15.txt](licenses/@radix-ui__react-collection@1.1.15.txt) |
| @radix-ui/react-compose-refs | 1.1.5 | MIT | — | [@radix-ui__react-compose-refs@1.1.5.txt](licenses/@radix-ui__react-compose-refs@1.1.5.txt) |
| @radix-ui/react-context | 1.2.2 | MIT | — | [@radix-ui__react-context@1.2.2.txt](licenses/@radix-ui__react-context@1.2.2.txt) |
| @radix-ui/react-context-menu | 2.3.7 | MIT | — | [@radix-ui__react-context-menu@2.3.7.txt](licenses/@radix-ui__react-context-menu@2.3.7.txt) |
| @radix-ui/react-dialog | 1.1.23 | MIT | — | [@radix-ui__react-dialog@1.1.23.txt](licenses/@radix-ui__react-dialog@1.1.23.txt) |
| @radix-ui/react-direction | 1.1.4 | MIT | — | [@radix-ui__react-direction@1.1.4.txt](licenses/@radix-ui__react-direction@1.1.4.txt) |
| @radix-ui/react-dismissable-layer | 1.1.19 | MIT | — | [@radix-ui__react-dismissable-layer@1.1.19.txt](licenses/@radix-ui__react-dismissable-layer@1.1.19.txt) |
| @radix-ui/react-dropdown-menu | 2.1.24 | MIT | — | [@radix-ui__react-dropdown-menu@2.1.24.txt](licenses/@radix-ui__react-dropdown-menu@2.1.24.txt) |
| @radix-ui/react-focus-guards | 1.1.6 | MIT | — | [@radix-ui__react-focus-guards@1.1.6.txt](licenses/@radix-ui__react-focus-guards@1.1.6.txt) |
| @radix-ui/react-focus-scope | 1.1.16 | MIT | — | [@radix-ui__react-focus-scope@1.1.16.txt](licenses/@radix-ui__react-focus-scope@1.1.16.txt) |
| @radix-ui/react-form | 0.1.16 | MIT | — | [@radix-ui__react-form@0.1.16.txt](licenses/@radix-ui__react-form@0.1.16.txt) |
| @radix-ui/react-hover-card | 1.1.23 | MIT | — | [@radix-ui__react-hover-card@1.1.23.txt](licenses/@radix-ui__react-hover-card@1.1.23.txt) |
| @radix-ui/react-id | 1.1.4 | MIT | — | [@radix-ui__react-id@1.1.4.txt](licenses/@radix-ui__react-id@1.1.4.txt) |
| @radix-ui/react-label | 2.1.15 | MIT | — | [@radix-ui__react-label@2.1.15.txt](licenses/@radix-ui__react-label@2.1.15.txt) |
| @radix-ui/react-menu | 2.1.24 | MIT | — | [@radix-ui__react-menu@2.1.24.txt](licenses/@radix-ui__react-menu@2.1.24.txt) |
| @radix-ui/react-menubar | 1.1.24 | MIT | — | [@radix-ui__react-menubar@1.1.24.txt](licenses/@radix-ui__react-menubar@1.1.24.txt) |
| @radix-ui/react-navigation-menu | 1.2.22 | MIT | — | [@radix-ui__react-navigation-menu@1.2.22.txt](licenses/@radix-ui__react-navigation-menu@1.2.22.txt) |
| @radix-ui/react-one-time-password-field | 0.1.16 | MIT | — | [@radix-ui__react-one-time-password-field@0.1.16.txt](licenses/@radix-ui__react-one-time-password-field@0.1.16.txt) |
| @radix-ui/react-password-toggle-field | 0.1.11 | MIT | — | [@radix-ui__react-password-toggle-field@0.1.11.txt](licenses/@radix-ui__react-password-toggle-field@0.1.11.txt) |
| @radix-ui/react-popover | 1.1.23 | MIT | — | [@radix-ui__react-popover@1.1.23.txt](licenses/@radix-ui__react-popover@1.1.23.txt) |
| @radix-ui/react-popper | 1.3.7 | MIT | — | [@radix-ui__react-popper@1.3.7.txt](licenses/@radix-ui__react-popper@1.3.7.txt) |
| @radix-ui/react-portal | 1.1.17 | MIT | — | [@radix-ui__react-portal@1.1.17.txt](licenses/@radix-ui__react-portal@1.1.17.txt) |
| @radix-ui/react-presence | 1.1.10 | MIT | — | [@radix-ui__react-presence@1.1.10.txt](licenses/@radix-ui__react-presence@1.1.10.txt) |
| @radix-ui/react-primitive | 2.1.10 | MIT | — | [@radix-ui__react-primitive@2.1.10.txt](licenses/@radix-ui__react-primitive@2.1.10.txt) |
| @radix-ui/react-progress | 1.1.16 | MIT | — | [@radix-ui__react-progress@1.1.16.txt](licenses/@radix-ui__react-progress@1.1.16.txt) |
| @radix-ui/react-radio-group | 1.4.7 | MIT | — | [@radix-ui__react-radio-group@1.4.7.txt](licenses/@radix-ui__react-radio-group@1.4.7.txt) |
| @radix-ui/react-roving-focus | 1.1.19 | MIT | — | [@radix-ui__react-roving-focus@1.1.19.txt](licenses/@radix-ui__react-roving-focus@1.1.19.txt) |
| @radix-ui/react-scroll-area | 1.2.18 | MIT | — | [@radix-ui__react-scroll-area@1.2.18.txt](licenses/@radix-ui__react-scroll-area@1.2.18.txt) |
| @radix-ui/react-select | 2.3.7 | MIT | — | [@radix-ui__react-select@2.3.7.txt](licenses/@radix-ui__react-select@2.3.7.txt) |
| @radix-ui/react-separator | 1.1.15 | MIT | — | [@radix-ui__react-separator@1.1.15.txt](licenses/@radix-ui__react-separator@1.1.15.txt) |
| @radix-ui/react-slider | 1.4.7 | MIT | — | [@radix-ui__react-slider@1.4.7.txt](licenses/@radix-ui__react-slider@1.4.7.txt) |
| @radix-ui/react-slot | 1.3.3 | MIT | — | [@radix-ui__react-slot@1.3.3.txt](licenses/@radix-ui__react-slot@1.3.3.txt) |
| @radix-ui/react-switch | 1.3.7 | MIT | — | [@radix-ui__react-switch@1.3.7.txt](licenses/@radix-ui__react-switch@1.3.7.txt) |
| @radix-ui/react-tabs | 1.1.21 | MIT | — | [@radix-ui__react-tabs@1.1.21.txt](licenses/@radix-ui__react-tabs@1.1.21.txt) |
| @radix-ui/react-toast | 1.2.23 | MIT | — | [@radix-ui__react-toast@1.2.23.txt](licenses/@radix-ui__react-toast@1.2.23.txt) |
| @radix-ui/react-toggle | 1.1.18 | MIT | — | [@radix-ui__react-toggle@1.1.18.txt](licenses/@radix-ui__react-toggle@1.1.18.txt) |
| @radix-ui/react-toggle-group | 1.1.19 | MIT | — | [@radix-ui__react-toggle-group@1.1.19.txt](licenses/@radix-ui__react-toggle-group@1.1.19.txt) |
| @radix-ui/react-toolbar | 1.1.19 | MIT | — | [@radix-ui__react-toolbar@1.1.19.txt](licenses/@radix-ui__react-toolbar@1.1.19.txt) |
| @radix-ui/react-tooltip | 1.2.16 | MIT | — | [@radix-ui__react-tooltip@1.2.16.txt](licenses/@radix-ui__react-tooltip@1.2.16.txt) |
| @radix-ui/react-use-callback-ref | 1.1.4 | MIT | — | [@radix-ui__react-use-callback-ref@1.1.4.txt](licenses/@radix-ui__react-use-callback-ref@1.1.4.txt) |
| @radix-ui/react-use-controllable-state | 1.2.6 | MIT | — | [@radix-ui__react-use-controllable-state@1.2.6.txt](licenses/@radix-ui__react-use-controllable-state@1.2.6.txt) |
| @radix-ui/react-use-effect-event | 0.0.5 | MIT | — | [@radix-ui__react-use-effect-event@0.0.5.txt](licenses/@radix-ui__react-use-effect-event@0.0.5.txt) |
| @radix-ui/react-use-escape-keydown | 1.1.5 | MIT | — | [@radix-ui__react-use-escape-keydown@1.1.5.txt](licenses/@radix-ui__react-use-escape-keydown@1.1.5.txt) |
| @radix-ui/react-use-is-hydrated | 0.1.3 | MIT | — | [@radix-ui__react-use-is-hydrated@0.1.3.txt](licenses/@radix-ui__react-use-is-hydrated@0.1.3.txt) |
| @radix-ui/react-use-layout-effect | 1.1.4 | MIT | — | [@radix-ui__react-use-layout-effect@1.1.4.txt](licenses/@radix-ui__react-use-layout-effect@1.1.4.txt) |
| @radix-ui/react-use-previous | 1.1.4 | MIT | — | [@radix-ui__react-use-previous@1.1.4.txt](licenses/@radix-ui__react-use-previous@1.1.4.txt) |
| @radix-ui/react-use-rect | 1.1.4 | MIT | — | [@radix-ui__react-use-rect@1.1.4.txt](licenses/@radix-ui__react-use-rect@1.1.4.txt) |
| @radix-ui/react-use-size | 1.1.4 | MIT | — | [@radix-ui__react-use-size@1.1.4.txt](licenses/@radix-ui__react-use-size@1.1.4.txt) |
| @radix-ui/react-visually-hidden | 1.2.11 | MIT | — | [@radix-ui__react-visually-hidden@1.2.11.txt](licenses/@radix-ui__react-visually-hidden@1.2.11.txt) |
| @radix-ui/rect | 1.1.3 | MIT | — | [@radix-ui__rect@1.1.3.txt](licenses/@radix-ui__rect@1.1.3.txt) |
| @swc/helpers | 0.5.23 | Apache-2.0 | 강동윤 | [@swc__helpers@0.5.23.txt](licenses/@swc__helpers@0.5.23.txt) |
| @types/node | 22.19.19 | MIT | — | [@types__node@22.19.19.txt](licenses/@types__node@22.19.19.txt) |
| @types/react | 19.2.14 | MIT | — | [@types__react@19.2.14.txt](licenses/@types__react@19.2.14.txt) |
| @types/react-dom | 19.2.3 | MIT | — | [@types__react-dom@19.2.3.txt](licenses/@types__react-dom@19.2.3.txt) |
| ansi-regex | 5.0.1 | MIT | Sindre Sorhus | [ansi-regex@5.0.1.txt](licenses/ansi-regex@5.0.1.txt) |
| ansi-styles | 4.3.0 | MIT | Sindre Sorhus | [ansi-styles@4.3.0.txt](licenses/ansi-styles@4.3.0.txt) |
| aria-hidden | 1.2.6 | MIT | Anton Korzunov | [aria-hidden@1.2.6.txt](licenses/aria-hidden@1.2.6.txt) |
| baseline-browser-mapping | 2.11.22 | Apache-2.0 | — | [baseline-browser-mapping@2.11.22.txt](licenses/baseline-browser-mapping@2.11.22.txt) |
| browserslist | 4.28.9 | MIT | Andrey Sitnik | [browserslist@4.28.9.txt](licenses/browserslist@4.28.9.txt) |
| camelcase | 5.3.1 | MIT | Sindre Sorhus | [camelcase@5.3.1.txt](licenses/camelcase@5.3.1.txt) |
| caniuse-lite | 1.0.30001810 | CC-BY-4.0 | Ben Briggs | [caniuse-lite@1.0.30001810.txt](licenses/caniuse-lite@1.0.30001810.txt) |
| class-variance-authority | 0.7.1 | Apache-2.0 | Joe Bell | [class-variance-authority@0.7.1.txt](licenses/class-variance-authority@0.7.1.txt) |
| client-only | 0.0.1 | MIT | — | [client-only@0.0.1.txt](licenses/client-only@0.0.1.txt) |
| cliui | 6.0.0 | ISC | Ben Coe | [cliui@6.0.0.txt](licenses/cliui@6.0.0.txt) |
| clsx | 2.1.1 | MIT | Luke Edwards | [clsx@2.1.1.txt](licenses/clsx@2.1.1.txt) |
| color-convert | 2.0.1 | MIT | Heather Arthur | [color-convert@2.0.1.txt](licenses/color-convert@2.0.1.txt) |
| color-name | 1.1.4 | MIT | DY | [color-name@1.1.4.txt](licenses/color-name@1.1.4.txt) |
| convert-source-map | 2.0.0 | MIT | Thorsten Lorenz | [convert-source-map@2.0.0.txt](licenses/convert-source-map@2.0.0.txt) |
| csstype | 3.2.3 | MIT | Fredrik Nicol | [csstype@3.2.3.txt](licenses/csstype@3.2.3.txt) |
| debug | 4.4.3 | MIT | Josh Junon | [debug@4.4.3.txt](licenses/debug@4.4.3.txt) |
| decamelize | 1.2.0 | MIT | Sindre Sorhus | [decamelize@1.2.0.txt](licenses/decamelize@1.2.0.txt) |
| detect-libc | 2.1.2 | Apache-2.0 | Lovell Fuller | [detect-libc@2.1.2.txt](licenses/detect-libc@2.1.2.txt) |
| detect-node-es | 1.1.0 | MIT | Ilya Kantor | [detect-node-es@1.1.0.txt](licenses/detect-node-es@1.1.0.txt) |
| dijkstrajs | 1.0.3 | MIT | — | [dijkstrajs@1.0.3.txt](licenses/dijkstrajs@1.0.3.txt) |
| electron-to-chromium | 1.5.427 | ISC | Kilian Valkhof | [electron-to-chromium@1.5.427.txt](licenses/electron-to-chromium@1.5.427.txt) |
| emoji-regex | 8.0.0 | MIT | Mathias Bynens | [emoji-regex@8.0.0.txt](licenses/emoji-regex@8.0.0.txt) |
| escalade | 3.2.0 | MIT | Luke Edwards | [escalade@3.2.0.txt](licenses/escalade@3.2.0.txt) |
| find-up | 4.1.0 | MIT | Sindre Sorhus | [find-up@4.1.0.txt](licenses/find-up@4.1.0.txt) |
| gensync | 1.0.0-beta.2 | MIT | Logan Smyth | [gensync@1.0.0-beta.2.txt](licenses/gensync@1.0.0-beta.2.txt) |
| get-caller-file | 2.0.5 | ISC | Stefan Penner | [get-caller-file@2.0.5.txt](licenses/get-caller-file@2.0.5.txt) |
| get-nonce | 1.0.1 | MIT | Anton Korzunov | [get-nonce@1.0.1.txt](licenses/get-nonce@1.0.1.txt) |
| has-flag | 4.0.0 | MIT | Sindre Sorhus | [has-flag@4.0.0.txt](licenses/has-flag@4.0.0.txt) |
| is-fullwidth-code-point | 3.0.0 | MIT | Sindre Sorhus | [is-fullwidth-code-point@3.0.0.txt](licenses/is-fullwidth-code-point@3.0.0.txt) |
| js-tokens | 4.0.0 | MIT | Simon Lydell | [js-tokens@4.0.0.txt](licenses/js-tokens@4.0.0.txt) |
| jsesc | 3.1.0 | MIT | Mathias Bynens | [jsesc@3.1.0.txt](licenses/jsesc@3.1.0.txt) |
| json5 | 2.2.3 | MIT | Aseem Kishore | [json5@2.2.3.txt](licenses/json5@2.2.3.txt) |
| locate-path | 5.0.0 | MIT | Sindre Sorhus | [locate-path@5.0.0.txt](licenses/locate-path@5.0.0.txt) |
| lru-cache | 5.1.1 | ISC | Isaac Z. Schlueter | [lru-cache@5.1.1.txt](licenses/lru-cache@5.1.1.txt) |
| lucide-react | 1.44.0 | ISC | Eric Fennis | [lucide-react@1.44.0.txt](licenses/lucide-react@1.44.0.txt) |
| ms | 2.1.3 | MIT | — | [ms@2.1.3.txt](licenses/ms@2.1.3.txt) |
| nanoid | 3.3.19 | MIT | Andrey Sitnik | [nanoid@3.3.19.txt](licenses/nanoid@3.3.19.txt) |
| next | 16.3.4 | MIT | Vercel | [next@16.3.4.txt](licenses/next@16.3.4.txt) |
| node-releases | 2.0.55 | MIT | Sergey Rubanov | [node-releases@2.0.55.txt](licenses/node-releases@2.0.55.txt) |
| p-limit | 2.3.0 | MIT | Sindre Sorhus | [p-limit@2.3.0.txt](licenses/p-limit@2.3.0.txt) |
| p-locate | 4.1.0 | MIT | Sindre Sorhus | [p-locate@4.1.0.txt](licenses/p-locate@4.1.0.txt) |
| p-try | 2.2.0 | MIT | Sindre Sorhus | [p-try@2.2.0.txt](licenses/p-try@2.2.0.txt) |
| path-exists | 4.0.0 | MIT | Sindre Sorhus | [path-exists@4.0.0.txt](licenses/path-exists@4.0.0.txt) |
| picocolors | 1.1.1 | ISC | Alexey Raspopov | [picocolors@1.1.1.txt](licenses/picocolors@1.1.1.txt) |
| pngjs | 5.0.0 | MIT | — | [pngjs@5.0.0.txt](licenses/pngjs@5.0.0.txt) |
| postcss | 8.5.23 | MIT | Andrey Sitnik | [postcss@8.5.23.txt](licenses/postcss@8.5.23.txt) |
| qrcode | 1.5.4 | MIT | Ryan Day | [qrcode@1.5.4.txt](licenses/qrcode@1.5.4.txt) |
| radix-ui | 1.6.7 | MIT | WorkOS | [radix-ui@1.6.7.txt](licenses/radix-ui@1.6.7.txt) |
| react | 19.2.6 | MIT | Meta Platforms, Inc. and affiliates | [react@19.2.6.txt](licenses/react@19.2.6.txt) |
| react-dom | 19.2.6 | MIT | Meta Platforms, Inc. and affiliates | [react-dom@19.2.6.txt](licenses/react-dom@19.2.6.txt) |
| react-remove-scroll | 2.7.2 | MIT | Anton Korzunov | [react-remove-scroll@2.7.2.txt](licenses/react-remove-scroll@2.7.2.txt) |
| react-remove-scroll-bar | 2.3.8 | MIT | Anton Korzunov | [react-remove-scroll-bar@2.3.8.txt](licenses/react-remove-scroll-bar@2.3.8.txt) |
| react-style-singleton | 2.2.3 | MIT | Anton Korzunov | [react-style-singleton@2.2.3.txt](licenses/react-style-singleton@2.2.3.txt) |
| require-directory | 2.1.1 | MIT | Troy Goode | [require-directory@2.1.1.txt](licenses/require-directory@2.1.1.txt) |
| require-main-filename | 2.0.0 | ISC | Ben Coe | [require-main-filename@2.0.0.txt](licenses/require-main-filename@2.0.0.txt) |
| scheduler | 0.27.0 | MIT | — | [scheduler@0.27.0.txt](licenses/scheduler@0.27.0.txt) |
| semver | 6.3.1 | ISC | GitHub Inc. | [semver@6.3.1.txt](licenses/semver@6.3.1.txt) |
| semver | 7.8.5 | ISC | GitHub Inc. | [semver@7.8.5.txt](licenses/semver@7.8.5.txt) |
| set-blocking | 2.0.0 | ISC | Ben Coe | [set-blocking@2.0.0.txt](licenses/set-blocking@2.0.0.txt) |
| sharp | 0.35.4 | Apache-2.0 | Lovell Fuller | [sharp@0.35.4.txt](licenses/sharp@0.35.4.txt) |
| source-map-js | 1.2.1 | BSD-3-Clause | Valentin 7rulnik Semirulnik | [source-map-js@1.2.1.txt](licenses/source-map-js@1.2.1.txt) |
| string-width | 4.2.3 | MIT | Sindre Sorhus | [string-width@4.2.3.txt](licenses/string-width@4.2.3.txt) |
| strip-ansi | 6.0.1 | MIT | Sindre Sorhus | [strip-ansi@6.0.1.txt](licenses/strip-ansi@6.0.1.txt) |
| styled-jsx | 5.1.6 | MIT | — | [styled-jsx@5.1.6.txt](licenses/styled-jsx@5.1.6.txt) |
| supports-color | 7.2.0 | MIT | Sindre Sorhus | [supports-color@7.2.0.txt](licenses/supports-color@7.2.0.txt) |
| tailwind-merge | 3.6.0 | MIT | Dany Castillo | [tailwind-merge@3.6.0.txt](licenses/tailwind-merge@3.6.0.txt) |
| tslib | 2.8.1 | 0BSD | Microsoft Corp. | [tslib@2.8.1.txt](licenses/tslib@2.8.1.txt) |
| undici-types | 6.21.0 | MIT | — | [undici-types@6.21.0.txt](licenses/undici-types@6.21.0.txt) |
| update-browserslist-db | 1.3.3 | MIT | Andrey Sitnik | [update-browserslist-db@1.3.3.txt](licenses/update-browserslist-db@1.3.3.txt) |
| use-callback-ref | 1.3.3 | MIT | theKashey | [use-callback-ref@1.3.3.txt](licenses/use-callback-ref@1.3.3.txt) |
| use-sidecar | 1.1.3 | MIT | theKashey | [use-sidecar@1.1.3.txt](licenses/use-sidecar@1.1.3.txt) |
| which-module | 2.0.1 | ISC | nexdrew | [which-module@2.0.1.txt](licenses/which-module@2.0.1.txt) |
| wrap-ansi | 6.2.0 | MIT | Sindre Sorhus | [wrap-ansi@6.2.0.txt](licenses/wrap-ansi@6.2.0.txt) |
| y18n | 4.0.3 | ISC | Ben Coe | [y18n@4.0.3.txt](licenses/y18n@4.0.3.txt) |
| yallist | 3.1.1 | ISC | Isaac Z. Schlueter | [yallist@3.1.1.txt](licenses/yallist@3.1.1.txt) |
| yargs | 15.4.1 | MIT | — | [yargs@15.4.1.txt](licenses/yargs@15.4.1.txt) |
| yargs-parser | 18.1.3 | ISC | Ben Coe | [yargs-parser@18.1.3.txt](licenses/yargs-parser@18.1.3.txt) |

_171 packages. Generated by `scripts/build-credits.mjs`._
