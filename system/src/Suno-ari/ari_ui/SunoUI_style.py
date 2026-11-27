# SPDX-License-Identifier: Apache-2.0
"""Ari-only surfaces; every visual value comes from SunoUI tokens.

Shared components retain their kit CSS. Pixel margins in the window module
describe v70's page layout, not component styling.
"""
from Suno_appkit import SunoUI_tokens as t


def build(_appearance):
    card, action, foot = t.CARD, t.ACTION_CENTER, t.STRUCTURE["foot"]
    # App-owned Models geometry from the owner's take-73 Models stylesheet.
    models = """
    .ari-filter-chip { padding: 0 13px; min-height: 34px; border-radius: 11px; background: @Suno_well; }
    .ari-filter-chip.selected { background: @Suno_hover; box-shadow: inset 0 0 0 1px @Suno_line; }
    .ari-models-page .SunoUI-t-caption { font-size: 12.5px; color: @Suno_ink_secondary; }
    .ari-models-page .SunoUI-t-caption, .ari-models-page .SunoUI-t-body { font-weight: 400; }
    .ari-model-actions button.SunoUI-bar-button { min-height: 36px; padding-top: 0; padding-bottom: 0; }
    .SunoUI-phone .ari-model-actions button.SunoUI-bar-button { min-height: 44px; }
    .ari-provider-row button.icon { min-width: 32px; min-height: 32px; padding: 0; background: transparent; }
    .ari-models-page .SunoUI-t-title-2 { font-size: 14px; font-weight: 650; }
    .ari-chatgpt-card .SunoUI-t-title-2 { font-size: 17px; font-weight: 720; }
    .ari-chatgpt-card .SunoUI-t-caption { font-size: 13.5px; }
    .ari-model-assignments button, .ari-provider-row button { min-height: 32px; padding: 0 12px; }
    .ari-models-description { font-size: 15px; color: @Suno_ink_secondary; }
    .ari-step-name { font-weight: 600; }
    .ari-models-page .ari-models-title { font-size: 32px; font-weight: 780; letter-spacing: -.8px; }
    .ari-models-page .ari-models-section { font-size: 18px; font-weight: 720; letter-spacing: -.18px; }
    .ari-assignments-card { padding: 0; }
    .ari-model-assignments > box { padding: 10px 16px; min-height: 44px; }
    .ari-model-assignments > box:first-child { min-height: 60px; }
    .ari-model-assignments > box:first-child .SunoUI-t-title-2 { font-size: 15.5px; }
    .ari-model-assignments > button { background: transparent; }
    .ari-providers-card { padding: 0; }
    .ari-provider-row { padding: 10px 16px; min-height: 44px; }
    .ari-provider-row button { background: @Suno_hover; border-radius: 10px; }
    .ari-chatgpt-card { padding: 20px; border-radius: 20px; }
    .ari-chatgpt-signin { min-height: 40px; padding: 0 18px; border-radius: 13px; }
    .phone .ari-chatgpt-signin { min-height: 44px; }
    .ari-open-model { padding: 0; background: transparent; border: none; box-shadow: none; }
    .ari-model-assignments button { background: @Suno_hover; border-radius: 10px; }
    .ari-model-assignments > button { min-height: 48px; border-radius: 0; }
    .ari-task-add { padding: 0 16px; color: @Suno_ink_secondary; }
    .ari-task-add image { margin-left: 14px; margin-right: 25px; }
    .ari-model-assignments button label, .ari-provider-row button label { font-weight: 600; }
    .ari-model-assignments button.icon { min-width: 28px; min-height: 28px; padding: 0; background: transparent; }
    .ari-size-rung { padding: 14px 16px; border-radius: 16px; background: @Suno_chip; box-shadow: inset 0 0 0 1px @Suno_line; }
    .ari-size-rung.selected { box-shadow: inset 0 0 0 2px @Suno_ink; }
    .ari-size-rung .SunoUI-t-title-1 { font-size: 20px; font-weight: 760; }
    .ari-size-rung .SunoUI-t-body { font-size: 12.5px; font-weight: 500; color: @Suno_faint; }
    .ari-family-card { padding: 18px; border-radius: 20px; background: @Suno_card_surface; box-shadow: inset 0 0 0 1px @Suno_line; }
    .ari-family-card:hover { background: @Suno_hover; }
    .ari-family-content .SunoUI-t-title-2 { font-size: 16px; font-weight: 700; }
    .ari-family-content > label { font-size: 13.5px; color: @Suno_ink_secondary; min-height: 39px; }
    .ari-recommended-card { padding: 24px; border-radius: 22px; background-image: linear-gradient(120deg, @Suno_ari_hero_wash, @Suno_card_surface 65%); }
    .ari-recommended-card .SunoUI-t-title-1 { font-size: 24px; font-weight: 760; }
    .ari-model-fit { padding: 14px 16px; border-radius: 16px; background: @Suno_well; box-shadow: inset 0 0 0 1px @Suno_well_ring; }
    .ari-removal-fallback { padding: 12px 14px; border-radius: 14px; background: @Suno_well; box-shadow: inset 0 0 0 1px @Suno_well_ring; }
    .ari-provider-row button.ari-open-model { padding: 0; min-height: 0; background: transparent; }
    button.ari-activity-source { min-height: 0; padding: 0; color: @Suno_muted; }
    button.ari-activity-source label { font-size: 12px; font-weight: 400; color: inherit; }
    """
    legacy = models + f"""
    .ari-connection {{ color: @Suno_good; }}
    .ari-welcome-copy {{ color: @Suno_muted; }}
    /* v71 .arich > header: 11 16 10, the title on its own line */
    .ari-receipt-heading {{
      padding: 11px {t.STRUCTURE['details']['header_padding_start']}px 10px;
      border-bottom: 1px solid @Suno_line;
    }}
    .ari-receipt-steps {{
      padding: {card['row_padding_x']}px {card['row_padding_y']}px;
    }}
    .ari-receipt-step {{ min-height: {foot['height']}px; padding: 0 {card['row_padding_y']}px; }}
    .ari-receipt-step.undone label {{ color: @Suno_muted; text-decoration: line-through; }}
    .ari-draft {{
      background: @Suno_well; color: @Suno_ink;
      border-radius: {t.ACCOUNT_CARD['radius']}px;
      box-shadow: inset 0 0 0 1px @Suno_well_ring;
      padding: {card['padding_top']}px {card['padding_x']}px;
      margin: {t.STRUCTURE['details']['section_gap_first']}px {t.STRUCTURE['details']['header_padding_start']}px {card['padding_bottom']}px;
    }}
    .ari-local-models {{
      background: @Suno_well;
      border-radius: {card['radius']}px;
      padding: {action['bar_padding']}px;
      box-shadow: inset 0 0 0 1px @Suno_well_ring;
    }}
    .ari-local-row {{ padding: {t.ACCOUNT_CARD['padding']}px; }}
    .ari-provider-sheet {{ padding: {t.DIALOG['padding_x']}px; }}
    """

    if not hasattr(t, "ARI"):
        return legacy
    a = t.ARI
    user, reply = a["user"], a["reply"]
    edge = a["edge_width"]
    receipt, approval = a["receipt"], a["approval"]
    mark, local, catalog, hero, sheet = a["mark"], a["local"], a["catalog"], a["hero"], a["sheet"]
    return legacy + f"""
    box.ari-user-bubble, box.ari-user-bubble-phone {{
      padding: {user["padding_y"]}px {user["padding_x"]}px;
      border-radius: {user["radius_top_start"]}px {user["radius_top_end"]}px {user["radius_bottom_end"]}px {user["radius_bottom_start"]}px;
    }}
    box.ari-user-bubble-phone {{ padding: {user["phone_padding_top"]}px {user["phone_padding_x"]}px {user["phone_padding_bottom"]}px; }}
    box.ari-reply-bubble {{
      padding: {reply["padding_top"]}px {reply["padding_x"]}px {reply["padding_bottom"]}px;
      border-radius: {reply["radius"]}px {reply["radius"]}px {reply["radius"]}px {reply["tail_radius"]}px;
    }}
    .ari-welcome-mark {{
      border-radius: {mark['welcome_radius']}px;
      box-shadow: 0 {mark['welcome_shadow_y']}px {mark['welcome_shadow_blur']}px {mark['welcome_shadow_spread']}px @Suno_ari_welcome_shadow;
    }}
    .ari-receipt-surface {{
      background: @Suno_chip;
      border-radius: {receipt['radius']}px;
      box-shadow: inset 0 0 0 {edge}px @Suno_chip_ring;
    }}
    .ari-receipt-heading {{ padding: {receipt['header_padding_top']}px {receipt['header_padding_x']}px {receipt['header_padding_bottom']}px; border-bottom-width: {edge}px; }}
    .ari-receipt-state-ask {{ color: @Suno_ari_ask; }}
    .ari-receipt-state-run {{ color: @Suno_ari_running; }}
    .ari-receipt-state-done, .ari-receipt-state-undone {{ color: @Suno_muted; }}
    .ari-step-waiting {{ color: @Suno_ari_waiting; }}
    .ari-receipt-steps {{
      padding: {receipt['steps_padding_top']}px {receipt['steps_padding_x']}px {receipt['steps_padding_bottom']}px;
    }}
    .ari-receipt-step {{
      min-height: {receipt['step_height']}px;
      padding: 0 {receipt['step_padding_x']}px;
      border-radius: {receipt['step_radius']}px;
    }}
    .compact .ari-receipt-step {{ min-height: {receipt['compact_step_height']}px; }}
    .ari-step-undone label {{ text-decoration: line-through; color: @Suno_faint; }}
    .ari-draft {{
      margin: 0;
      padding: {approval['padding_top']}px {approval['padding_x']}px {approval['padding_bottom']}px;
      border-radius: {approval['radius']}px;
      box-shadow: inset 0 0 0 {edge}px @Suno_well_ring;
    }}
    .ari-draft-copy {{ color: @Suno_muted; }}
    .ari-local-models {{ border-radius: {local['radius']}px; padding: {local['padding']}px; box-shadow: inset 0 0 0 {edge}px @Suno_well_ring; }}
    .ari-local-row {{
      padding: {local['row_padding_y']}px {local['row_padding_end']}px {local['row_padding_y']}px {local['row_padding_start']}px;
      border-radius: {local['row_radius']}px;
    }}
    .ari-provider-surface {{
      border-radius: {catalog['provider_radius']}px; padding: {catalog['provider_padding']}px;
      box-shadow: inset 0 0 0 {edge}px @Suno_line;
    }}
    .ari-model-surface {{
      border-radius: {catalog['card_radius']}px; padding: {catalog['card_padding']}px;
      box-shadow: inset 0 0 0 {edge}px @Suno_line;
    }}
    .ari-capability {{
      background: @Suno_hover;
      border-radius: {catalog['chip_radius']}px;
      padding: {catalog['chip_padding_y']}px {catalog['chip_padding_x']}px;
    }}
    .ari-monogram {{
      color: @Suno_ari_checkbox_ink;
      background: @Suno_hover;
      box-shadow: inset 0 {a['monogram']['highlight_y']}px 0 @Suno_ari_monogram_highlight, 0 {a['monogram']['shadow_y']}px {a['monogram']['shadow_blur']}px @Suno_ari_monogram_shadow;
    }}
    .ari-logo {{
      box-shadow: 0 0 0 {a['monogram']['logo_outline_width']}px @Suno_ari_logo_shadow, 0 {a['monogram']['shadow_y']}px {a['monogram']['shadow_blur']}px @Suno_ari_logo_shadow;
    }}
    .ari-provider-sheet {{ padding: {sheet['padding_top']}px {sheet['padding_x']}px {sheet['padding_bottom']}px; }}
    .ari-suggestion {{
      min-width: 0; min-height: 0;
      border: none; background: transparent; color: @Suno_ink_secondary;
      padding: {a['suggestion']['padding_y']}px {a['suggestion']['padding_x']}px;
      border-radius: {a['suggestion']['radius']}px;
      box-shadow: inset 0 0 0 {edge}px @Suno_line;
    }}
    .ari-suggestion:hover {{ background: @Suno_hover; color: @Suno_ink; }}
    .ari-suggestion-copy {{ color: @Suno_ink_secondary; }}
    .ari-suggestion-icon {{ color: @Suno_muted; }}
    .ari-memory-total {{ color: @Suno_ink_secondary; }}
    .ari-provider-bad {{ color: @Suno_ari_provider_error; }}
    .ari-provider-choice {{
      min-width: 0; min-height: 0;
      border: none; box-shadow: none; background: transparent; color: @Suno_ink;
      padding: {sheet['choice_padding_y']}px {sheet['choice_padding_end']}px {sheet['choice_padding_y']}px {sheet['choice_padding_start']}px;
      border-radius: {sheet['choice_radius']}px;
    }}
    .ari-provider-choice:hover {{ background: @Suno_hover; }}
    .ari-provider-choice:disabled {{ opacity: {sheet['choice_disabled_opacity']}; color: @Suno_ink; }}
    .ari-provider-choice:disabled:hover {{ background: transparent; }}
    .ari-provider-model {{
      min-width: 0; min-height: 0;
      border: none; box-shadow: none; background: transparent; color: @Suno_ink;
      padding: {sheet['model_padding_y']}px {sheet['model_padding_x']}px;
      border-radius: {sheet['model_radius']}px;
    }}
    .ari-provider-model:checked {{ background: transparent; }}
    .ari-provider-model:hover {{ background: @Suno_hover; }}
    .ari-provider-check {{
      border-radius: {sheet['checkbox_radius']}px;
      box-shadow: inset 0 0 0 {sheet['checkbox_border']}px @Suno_faint;
    }}
    .ari-provider-check-on {{ background: @Suno_accent_ink; box-shadow: none; color: @Suno_ari_checkbox_ink; }}
    .ari-hero-surface {{
      background-image: radial-gradient(ellipse {hero['wash_width_ratio'] * 100}% {hero['wash_height_ratio'] * 100}% at {hero['wash_origin_x_ratio'] * 100}% {hero['wash_origin_y_ratio'] * 100}%, @Suno_ari_hero_wash, transparent {hero['wash_end_ratio'] * 100}%);
      border-radius: {hero['radius']}px; padding: {hero['padding_y']}px {hero['padding_x']}px;
      box-shadow: inset 0 0 0 {edge}px @Suno_line;
    }}
    """


_registered_monograms = set()


def monogram_hue(hue):
    """An app-owned gradient, calculated solely from K's generated ratios."""
    from Suno_appkit import add_style_builder
    from Suno_appkit.SunoUI import oklch_rgba
    hue = round(float(hue)) % 360
    css_class = f"ari-monogram-h{hue}"
    if hue not in _registered_monograms:
        def gradient(_appearance):
            if not hasattr(t, "ARI"):
                return ""
            mono = t.ARI["monogram"]
            first = oklch_rgba(mono["light_ratio"], mono["chroma_ratio"], hue)
            last = oklch_rgba(mono["dark_ratio"], mono["chroma_ratio"], hue)
            return f".{css_class} {{ background-image: linear-gradient({mono['gradient_degrees']}deg, {first}, {last}); }}"
        add_style_builder(gradient)
        _registered_monograms.add(hue)
    return css_class
