# Changelog

_Auto-generated from git log on 2026-05-13. Run `node scripts/generate-changelog.js` to refresh._

## V11

- 2026-05-12 `138407d` **V11.2** — address 2 CodeRabbit findings on PR #2 — z-index overlap + a11y focus parity
- 2026-05-12 `241fd9c` **V11.1** — show 3-dot loader after Song Clear + suppress stale-transcript fallback for 3s
- 2026-05-12 `57d45e8` **V11** — defensive participant clear when admin presses Song Clear button

## V10

- 2026-05-12 `05e8fda` **V10.1 U2** — REDO: English fallback for service-ended modal static HTML
- 2026-05-12 `1f559df` **V10.1 U1** — REDO: define .btn-secondary in styles.css
- 2026-05-12 `7f2794d` **V10.1 O1+O2** — REDO: render.yaml + .env.example synced as single source of truth

## V9

- 2026-05-12 `6cbe4c7` **V9.1** — scoped red override for Library Delete buttons (Pinned + Song Library cards)
- 2026-05-12 `640b3a6` **V9** _(BUGFIX)_ — REDO: visible Delete buttons for Pinned Text Library + Song Library (admin UI)

## V7

- 2026-05-11 `1dc7846` **V7.1** _(HOTFIX)_ — move MOJIBAKE_MAP above normalizeTextInput to fix TDZ ReferenceError
- 2026-05-11 `979a15f` **V7** _(BUGFIX)_ — diacritic normalization (RO sedilla→comma) + mojibake repair + startup migration

## V6

- 2026-05-11 `dd9a6d5` **V6.2** _(BUGFIX)_ — add getDefaultOrganization to ctx object in server.js
- 2026-05-11 `8565660` **V6.1** _(BUGFIX)_ — add buildBlockLabels to events.js destructuring and server.js ctx
- 2026-05-11 `2836eb9` **V6** _(BUGFIX)_ — add getDefaultOrganization to routes/events.js destructuring

## V5

- 2026-05-11 `dccae36` **V5** _(BUGFIX)_ — layer 4: POST /admin/audit-translations endpoint with auto-clean
- 2026-05-11 `c493daf` **V5** _(BUGFIX)_ — language validation layers 1+2+3 — detector, validate+retry in translateText, dedup-on-load

## V4

- 2026-05-10 `a2a5d30` **V4** _(BUGFIX)_ — hide earlier lines/history during Bible Mode for clean aesthetics

## V3

- 2026-05-10 `e5b4821` **V3** _(BUGFIX)_ — song mode language fallback - no longer falls back to source text

## V2

- 2026-05-10 `4768b33` **V2** _(BUGFIX)_ — refined auto-title cleanup (prefix/suffix) + Clear button goes to Black Screen instead of Live Text

## V1

- 2026-05-10 `ecb7249` **V1** _(BUGFIX)_ — language fallback + auto-expire 6s on participant - fix wrong language displays + stale translations after mode switch

## Bible Mode V2

- 2026-05-09 `09e6a8e` **V2** _(Bible Mode)_ — refined participant message + hero topbar button with status

## Bible Mode V3

- 2026-05-09 `719a9b1` **V3.3** _(Bible Mode)_ — Live Text becomes Bible Reading title + subtle bottom instruction
- 2026-05-09 `b090348` **V3.2** _(Bible Mode)_ — bottom-fixed compact message + 3s pipeline drain
- 2026-05-09 `d010864` **V3.1** _(Bible Mode)_ — fix mute pre-On-Air - sync slider in UI-only branch

## Smart Flush V1

- 2026-05-10 `4755a34` **V1.2** _(Smart Flush)_ — timing tuning - MERGE 2s, MIN_DISPLAY 3s for better readability
- 2026-05-10 `ff96d6e` **V1.1** _(Smart Flush)_ — display buffer with chunk merging + 2s display delay on participant
- 2026-05-10 `dde7f62` **V1** _(Smart Flush)_ — trigger words for Romanian (și, să, dar, iar, așa flush before; că, posesive flush after; ca exception)

## Smart Flush V2

- 2026-05-10 `a1d77ab` **V2** _(Smart Flush)_ — reduce partial flush threshold (12→8) + Azure segmentation timeout (500→300ms)

## Smart Flush V3

- 2026-05-10 `ef15431` **V3** _(Smart Flush)_ — replace 'Waiting...' text with elegant 3-dot loading indicator

## Other

- 2026-05-10 `556d2c7` undefined
- 2026-05-09 `328e840` undefined
- 2026-05-08 `4a10c39` undefined
- 2026-05-08 `4707b70` undefined
- 2026-05-08 `66301a6` undefined
- 2026-05-07 `b81d01a` undefined
- 2026-05-03 `610818d` undefined
- 2026-05-03 `1c76fe0` undefined
- 2026-05-03 `9cd5cbc` undefined
- 2026-05-03 `3643be0` undefined
- 2026-05-03 `a725a55` undefined
- 2026-05-03 `dcf4d91` undefined
- 2026-05-03 `4815fea` undefined
- 2026-05-03 `01930c4` undefined
- 2026-05-03 `5776306` undefined
- 2026-05-03 `71ae729` undefined
- 2026-05-03 `0276151` undefined
- 2026-05-03 `9779b4c` undefined
- 2026-05-03 `1385bf2` undefined
- 2026-05-03 `50499ce` undefined
- 2026-05-03 `b2d11f5` undefined
- 2026-05-03 `7615954` undefined
- 2026-05-03 `28bb689` undefined
- 2026-05-03 `4e9e9ad` undefined
- 2026-05-03 `4eef53c` undefined
- 2026-05-03 `37f3a62` undefined
- 2026-05-03 `9c03cbc` undefined
- 2026-05-03 `5128da0` undefined
- 2026-05-03 `23098a1` undefined
- 2026-05-03 `92b0917` undefined
- 2026-05-03 `8df6ade` undefined
- 2026-05-03 `9b91c25` undefined
- 2026-05-03 `de6ae29` undefined
- 2026-05-03 `737bbbc` undefined
- 2026-05-03 `56eb504` undefined
- 2026-05-03 `614b0ba` undefined
- 2026-05-03 `b6754d1` undefined
- 2026-05-03 `a40d2dd` undefined
- 2026-05-02 `3b9cae2` undefined
- 2026-05-02 `82dce32` undefined
- 2026-05-02 `3c048d8` undefined
- 2026-05-02 `4a34258` undefined
- 2026-05-02 `13a4c94` undefined
- 2026-05-02 `f845acf` undefined
- 2026-05-02 `83dbc87` undefined
- 2026-05-02 `6a8bcf0` undefined
- 2026-05-02 `0046f8a` undefined
- 2026-05-02 `03875dc` undefined
- 2026-05-02 `e1dbef5` undefined
- 2026-05-02 `a5b57dc` undefined
- 2026-05-02 `9397e2c` undefined
- 2026-05-02 `b414769` undefined
- 2026-05-02 `4541eb5` undefined
- 2026-05-02 `8061e1e` undefined
- 2026-05-02 `eae3f6c` undefined
- 2026-05-02 `3634599` undefined
- 2026-05-02 `47150a2` undefined
- 2026-05-02 `44729e1` undefined
- 2026-05-02 `ff876c4` undefined
- 2026-05-02 `df54e26` undefined
- 2026-05-02 `b5203df` undefined
- 2026-05-02 `a746478` undefined
- 2026-05-02 `b8a8b38` undefined
- 2026-05-02 `5b615ee` undefined
- 2026-05-02 `2b315ae` undefined
- 2026-05-02 `b6b240b` undefined
- 2026-05-02 `518942f` undefined
- 2026-05-02 `6bec338` undefined
- 2026-05-02 `6f69602` undefined
- 2026-05-02 `43c13c7` undefined
- 2026-05-02 `4eac6ed` undefined
- 2026-05-02 `79111be` undefined
- 2026-05-02 `55354b6` undefined
- 2026-05-02 `2264826` undefined
- 2026-05-02 `7e200ec` undefined
- 2026-05-02 `f37d1ad` undefined
- 2026-05-02 `5475101` undefined
- 2026-05-02 `71dccd5` undefined
- 2026-05-02 `cdebafb` undefined
- 2026-05-02 `f58d2f5` undefined
- 2026-05-02 `a864ad5` undefined
- 2026-05-02 `9517c0d` undefined
- 2026-05-01 `c075b16` undefined
- 2026-05-01 `5040439` undefined
- 2026-05-01 `d005dd0` undefined
- 2026-05-01 `5f2de13` undefined
- 2026-05-01 `9f6a373` undefined
- 2026-05-01 `5b73b20` undefined
- 2026-05-01 `4d5cf9e` undefined
- 2026-05-01 `902f158` undefined
- 2026-05-01 `e936883` undefined
- 2026-05-01 `95a2ccb` undefined
- 2026-05-01 `99d35b2` undefined
- 2026-05-01 `2711150` undefined
- 2026-05-01 `f351274` undefined
- 2026-05-01 `3e20544` undefined
- 2026-05-01 `e90dbb1` undefined
- 2026-05-01 `a801ebe` undefined
- 2026-05-01 `363df31` undefined
- 2026-05-01 `931999e` undefined
- 2026-05-01 `eed97dd` undefined
- 2026-05-01 `b4f2a85` undefined
- 2026-05-01 `e7ada6a` undefined
- 2026-05-01 `c5e3b76` undefined
- 2026-05-01 `a0688b0` undefined
- 2026-05-01 `219dc7b` undefined
- 2026-05-01 `a305eb8` undefined
- 2026-05-01 `f372707` undefined
- 2026-05-01 `ae46b50` undefined
- 2026-05-01 `0ef386c` undefined
- 2026-05-01 `f91191b` undefined
- 2026-05-01 `6fd3bd7` undefined
- 2026-05-01 `6351883` undefined
- 2026-05-01 `3601ebf` undefined
- 2026-05-01 `6b644c1` undefined
- 2026-05-01 `c92b286` undefined
- 2026-05-01 `b910dbc` undefined
- 2026-05-01 `c1a3b84` undefined
- 2026-05-01 `8f206d6` undefined
- 2026-05-01 `cc09d0d` undefined
- 2026-05-01 `b7d48da` undefined
- 2026-05-01 `efac882` undefined
- 2026-05-01 `0881bdf` undefined
- 2026-05-01 `b80f9ad` undefined
- 2026-05-01 `fbb7505` undefined
- 2026-05-01 `81352f8` undefined
- 2026-05-01 `9c49d4b` undefined
- 2026-05-01 `6404d68` undefined
- 2026-05-01 `94ed846` undefined
- 2026-05-01 `96733cc` undefined
- 2026-05-01 `ba28724` undefined
- 2026-05-01 `47a2009` undefined
- 2026-05-01 `59e75ea` undefined
- 2026-05-01 `e0062be` undefined
- 2026-05-01 `afc2edc` undefined
- 2026-05-01 `608c251` undefined
- 2026-05-01 `c2f6ef5` undefined
- 2026-04-30 `76c9cc4` undefined
- 2026-04-30 `8832f0b` undefined
- 2026-04-30 `9929c42` undefined
- 2026-04-30 `254ac51` undefined
- 2026-04-30 `1655d38` undefined
- 2026-04-29 `14b1584` undefined
- 2026-04-29 `c6a3f5c` undefined
- 2026-04-29 `e2f89c3` undefined
- 2026-04-29 `3615785` undefined
- 2026-04-29 `2c545c6` undefined
- 2026-04-29 `bac8754` undefined
- 2026-04-29 `5841851` undefined
- 2026-04-29 `ab5a05b` undefined
- 2026-04-26 `5f7ccbb` undefined
- 2026-04-26 `72cda71` undefined
- 2026-04-26 `614e0a6` undefined
- 2026-04-26 `53a26e8` undefined
- 2026-04-26 `7dd4150` undefined
- 2026-04-26 `36693fc` undefined
- 2026-04-26 `d8d99df` undefined
- 2026-04-26 `dce0c41` undefined
- 2026-04-26 `09c9cdd` undefined
- 2026-04-25 `c091505` undefined
- 2026-04-25 `37d8c74` undefined
- 2026-04-25 `e478b9c` undefined
- 2026-04-25 `1ffe542` undefined
- 2026-04-25 `e2398ce` undefined
- 2026-04-25 `12b6296` undefined
- 2026-04-24 `37e9d76` undefined
- 2026-04-24 `9fa190e` undefined
- 2026-04-24 `1375831` undefined
- 2026-04-24 `b1524ac` undefined
- 2026-04-24 `b0179b6` undefined
- 2026-04-24 `d030980` undefined
- 2026-04-24 `10d819a` undefined
- 2026-04-24 `f4c20fa` undefined
- 2026-04-24 `d0e9a92` undefined
- 2026-04-24 `fe3f0a1` undefined
- 2026-04-24 `8f90cd4` undefined
- 2026-04-24 `b88d21c` undefined
- 2026-04-24 `a452c80` undefined
- 2026-04-24 `2a1c7bc` undefined
- 2026-04-24 `eb783e8` undefined
- 2026-04-23 `5874b13` undefined
- 2026-04-23 `3998369` undefined
- 2026-04-23 `99a760b` undefined
- 2026-04-23 `3b60e9f` undefined
- 2026-04-23 `1fb9591` undefined
- 2026-04-23 `64da9bd` undefined
- 2026-04-23 `2f9820c` undefined
- 2026-04-23 `fb350ab` undefined
- 2026-04-23 `805bcb5` undefined
- 2026-04-23 `66ec1a4` undefined
- 2026-04-22 `9d4ccca` undefined
- 2026-04-22 `092d93e` undefined
- 2026-04-22 `ca3f0c5` undefined
- 2026-04-22 `32f9fa1` undefined
- 2026-04-19 `cbdc1d5` undefined
- 2026-04-19 `a824d26` undefined
- 2026-04-19 `ce08a83` undefined
- 2026-04-19 `d2ea903` undefined
- 2026-04-19 `b894536` undefined
- 2026-04-19 `9da5def` undefined
- 2026-04-19 `6f7becb` undefined
- 2026-04-19 `c0f94da` undefined
- 2026-04-19 `444fd63` undefined
- 2026-04-19 `812ba00` undefined
- 2026-04-19 `8c17572` undefined
- 2026-04-19 `94e0941` undefined
- 2026-04-19 `c91979e` undefined
- 2026-04-19 `9d4bf9e` undefined
- 2026-04-19 `e812a77` undefined
- 2026-04-19 `669815c` undefined
- 2026-04-19 `2b557af` undefined
- 2026-04-19 `b3c1557` undefined
- 2026-04-19 `78e86dc` undefined
- 2026-04-18 `394759e` undefined
- 2026-04-18 `11deaf6` undefined
- 2026-04-18 `1e42479` undefined
- 2026-04-18 `6c2e181` undefined
- 2026-04-18 `a27b0e4` undefined
- 2026-04-18 `995a855` undefined
- 2026-04-18 `4c014a9` undefined
- 2026-04-18 `2d70382` undefined
- 2026-04-18 `6b5dec9` undefined
- 2026-04-18 `5be04e9` undefined
- 2026-04-18 `2ce8fd1` undefined
- 2026-04-18 `77dcfda` undefined
- 2026-04-18 `ec6e731` undefined
- 2026-04-18 `3212eab` undefined
- 2026-04-18 `bb7325b` undefined
- 2026-04-18 `ece3713` undefined
- 2026-04-18 `ddac214` undefined
- 2026-04-18 `ceb717e` undefined
- 2026-04-18 `5a6cc60` undefined
- 2026-04-18 `424ebf2` undefined
- 2026-04-17 `e0349d8` undefined
- 2026-04-17 `6700bb8` undefined
- 2026-04-17 `0be697d` undefined
- 2026-04-17 `60e59fd` undefined
- 2026-04-17 `f5e8287` undefined
- 2026-04-17 `0132b57` undefined
- 2026-04-17 `a66e43b` undefined
- 2026-04-17 `12c2385` undefined
- 2026-04-17 `83f885b` undefined
- 2026-04-17 `a093fc8` undefined
- 2026-04-17 `d36bf2e` undefined
- 2026-04-17 `63705f1` undefined
- 2026-04-17 `8c7142a` undefined
- 2026-04-17 `8c1d8ae` undefined
- 2026-04-17 `f1f0bce` undefined
- 2026-04-16 `328295b` undefined
- 2026-04-16 `e4e5b46` undefined
- 2026-04-16 `08fcc66` undefined
- 2026-04-16 `04f9fe8` undefined
- 2026-04-16 `383c7b3` undefined
- 2026-04-16 `5cc9de8` undefined
- 2026-04-16 `17e5697` undefined
- 2026-04-16 `1f25b71` undefined
- 2026-04-16 `b696a33` undefined
- 2026-04-16 `da84d67` undefined
- 2026-04-16 `603129f` undefined
- 2026-04-16 `c28c82f` undefined
- 2026-04-16 `79b33d8` undefined
- 2026-04-16 `e7e5da7` undefined
- 2026-04-16 `424e884` undefined
- 2026-04-16 `96e369b` undefined
- 2026-04-16 `f58e9fe` undefined
- 2026-04-16 `d84506e` undefined
- 2026-04-16 `de1ba01` undefined
- 2026-04-16 `89242d6` undefined
- 2026-04-16 `2f877e2` undefined
- 2026-04-16 `e06b4aa` undefined
- 2026-04-16 `93d7f50` undefined
- 2026-04-16 `e034cff` undefined
- 2026-04-15 `e8d9c27` undefined
- 2026-04-15 `6610dea` undefined
- 2026-04-15 `f28fa0a` undefined
- 2026-04-15 `b6ade80` undefined
- 2026-04-15 `177306a` undefined
- 2026-04-15 `c14a80c` undefined
- 2026-04-15 `43ef216` undefined
- 2026-04-15 `cfa72bb` undefined
- 2026-04-15 `9b91b19` undefined
- 2026-04-15 `ad3560b` undefined
- 2026-04-15 `986ddae` undefined
- 2026-04-15 `fad660b` undefined
- 2026-04-15 `16b61b1` undefined
- 2026-04-15 `7d65000` undefined
- 2026-04-15 `a2213e6` undefined
- 2026-04-15 `000c833` undefined
- 2026-04-15 `e1b701f` undefined
- 2026-04-15 `71208b1` undefined
- 2026-04-15 `eaebb98` undefined
- 2026-04-15 `51c35d4` undefined
- 2026-04-15 `8e3956f` undefined
- 2026-04-15 `a0b8dc4` undefined
- 2026-04-15 `edfde14` undefined
