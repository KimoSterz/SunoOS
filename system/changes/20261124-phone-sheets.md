---
type: improvement
component: Platform
packages: [luma-developer-platform]
---
Summary: Sheets rise from the bottom on phones
Details: On phones, tablets and the Fold, save prompts, app questions and delete confirmations rise from the action bar's place with the bar's buttons, and a swipe down cancels them. They ride above the on-screen keyboard and keep clear of a landscape notch. Desktop windows keep the sheet under the title bar. New LumaUI API: LumaSheetRole (LUMA_SHEET_ROLE_NONE, _PRIMARY, _SECONDARY, _CANCEL, _DESTRUCTIVE, _DESTRUCTIVE_ACTION; luma_sheet_role_get_type, LUMA_TYPE_SHEET_ROLE), luma_sheet_button_set_role, luma_sheet_button_get_role, luma_save_sheet_add_choice and LUMA_SAVE_CHOICE_OTHER. Follow-up: sheet D-Ink presentation waits on a kit D-Ink posture. Follow-up: hinge-aware placement on the Fold and Duo waits on hinge data in the device display profile.
