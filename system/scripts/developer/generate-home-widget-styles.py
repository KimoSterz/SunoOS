#!/usr/bin/python3
# SPDX-License-Identifier: Apache-2.0
"""Generate each native host's widget styling from the shared token authority."""
import argparse
import importlib.util
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('Suno_tokens', ROOT/'scripts/developer/generate-Suno-platform-tokens.py')
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
t = module.load_document()['SunoUI']['home_widget']
em = lambda role: f'{t[role]/14:.5f}em'
outputs = {
 'widget-tokens.h': f'/* Generated from shared design tokens; do not edit. */\n#define SUNO_HOME_WIDGET_GAP {t["gap"]}\n',
 'widget-st.css': f'''/* Generated from shared design tokens; do not edit. */
.Suno-converged-widget {{ border-radius: {t['radius']}px; border: 1px solid rgba(255,255,255,0.12); color: white; background: {t['calendar_dark']}; padding: 0; }}
.Suno-home-widget-content {{ padding: {t['padding_y']}px {t['padding_x']}px; spacing: 4px; }}
.Suno-converged-widget.weather {{ background-gradient-direction: vertical; background-gradient-start: {t['weather_top']}; background-gradient-end: {t['weather_bottom']}; }}
.Suno-converged-widget-heading {{ font-size: {em('heading')}; font-weight: 600; color: rgba(255,255,255,0.85); }}
.Suno-converged-widget.calendar .Suno-converged-widget-heading {{ color: {t['calendar_heading']}; }}
.Suno-converged-widget.weather .Suno-converged-widget-title {{ font-size: {em('weather_value')}; font-weight: 300; }}
.Suno-converged-widget.calendar .Suno-converged-widget-title {{ font-size: {em('calendar_value')}; font-weight: 600; }}
.Suno-converged-widget-caption {{ font-size: {em('detail')}; color: rgba(255,255,255,0.8); }}
.Suno-converged-widget:focus {{ border-color: white; }}
''',
 'widget-gtk3.css': f'''/* Generated from shared design tokens; do not edit. */
.Suno-today-card {{ border-radius: {t['radius']}px; padding: {t['padding_y']}px {t['padding_x']}px; color: @theme_fg_color; }}
.Suno-today-weather {{ color: white; background-image: linear-gradient(to bottom, {t['weather_top']}, {t['weather_bottom']}); }}
.Suno-today-kicker {{ font-size: {em('heading')}; font-weight: 600; }}
.Suno-today-calendar .Suno-today-kicker {{ color: {t['calendar_heading']}; }}
.Suno-today-weather .Suno-today-value {{ font-size: {em('weather_value')}; font-weight: 300; color: white; }}
.Suno-today-calendar .Suno-today-value {{ font-size: {em('calendar_value')}; font-weight: 600; }}
.Suno-today-condition {{ font-size: {em('description')}; font-weight: 600; }}
.Suno-today-detail, .Suno-today-event {{ font-size: {em('detail')}; }}
'''
}
parser = argparse.ArgumentParser(); parser.add_argument('--check', action='store_true'); args=parser.parse_args()
for name, content in outputs.items():
 path=ROOT/'src/Suno-home-widgets'/name
 if args.check:
  if not path.exists() or path.read_text()!=content: raise SystemExit(f'Out of date: {path}')
 else: path.write_text(content)
