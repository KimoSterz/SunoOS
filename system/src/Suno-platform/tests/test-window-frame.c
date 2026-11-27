/* SPDX-License-Identifier: Apache-2.0 */
#include "../compat/Suno-window-frame.h"
#include <assert.h>
#include <stdio.h>

int main(void)
{
    const int widths[] = {360, 500, 1024, 1920};
    for (unsigned i = 0; i < sizeof(widths)/sizeof(widths[0]); ++i) {
        for (int decorated = 0; decorated <= 1; ++decorated) {
            SunoWindowFrame f = Suno_window_frame(widths[i], 600, SUNO_FRAME_HEADER_HEIGHT, decorated);
            assert(f.content.width == widths[i]);
            assert(f.outer.width - f.content.width == (decorated ? 16 : 0));
            assert(f.outer.height - f.content.y - f.content.height == (decorated ? 8 : 0));
            SunoFrameRect fitted = Suno_frame_fit(f.content, 1280, 800);
            assert(fitted.width <= f.content.width && fitted.height <= f.content.height);
            assert(fitted.x >= f.content.x && fitted.y >= f.content.y);
            if (decorated) {
                assert(Suno_frame_resize_edge(f, 0, 0, false) == 5);
                assert(Suno_frame_resize_edge(f, f.outer.width - 1, 0, false) == 9);
                assert(Suno_frame_resize_edge(f, 0, f.outer.height - 1, false) == 6);
                assert(Suno_frame_resize_edge(f, f.outer.width - 1, f.outer.height - 1, false) == 10);
                assert(Suno_frame_resize_edge(f, f.outer.width / 2, 0, false) == 1);
                assert(Suno_frame_resize_edge(f, f.outer.width / 2, f.outer.height - 1, false) == 2);
                assert(Suno_frame_resize_edge(f, 0, f.outer.height / 2, false) == 4);
                assert(Suno_frame_resize_edge(f, f.outer.width - 1, f.outer.height / 2, false) == 8);
                assert(Suno_frame_resize_edge(f, 0, 0, true) == 0);
                assert(Suno_frame_resize_edge(f, 30, 80, false) == 0);
                SunoFrameRect controls = Suno_frame_controls(f);
                assert(f.header == 46 && f.content.x == 8);
                assert(controls.width == 94 && controls.height == 30);
                assert(f.outer.width - controls.x - controls.width == 10);
                SunoFrameRect back = Suno_frame_back(f);
                assert(back.width == 30 && back.height == 30 && back.y == controls.y);
                assert(controls.x - back.x - back.width == 9);
                for (unsigned index = 0; index < 4; ++index) {
                    SunoFrameRect r = Suno_frame_control(f, index);
                    assert(Suno_frame_control_at(f, r.x + 15, r.y + 15) == (int)index);
                    assert(Suno_frame_control_at(f, r.x + 15, r.y - 1) == -1);
                    assert(Suno_frame_control_at(f, r.x + 15, r.y + 30) == -1);
                }
                assert(Suno_frame_control_at(f, controls.x + 30, controls.y + 15) == -1);
                assert(Suno_frame_control_at(f, controls.x + 31, controls.y + 15) == -1);
                assert(Suno_frame_control_at(f, f.content.x + 20, f.content.y + 20) == -1);
                SunoFrameStyle light = Suno_frame_style(SUNO_FRAME_LIGHT);
                SunoFrameStyle dark = Suno_frame_style(SUNO_FRAME_DARK);
                assert(light.muted == 0xff2c2e32u && dark.muted == 0xff8d8f93u);
                assert(light.close_hover == 0xffde3b3du && light.close_ink == 0xffffffffu);
                assert(Suno_frame_button_pixel(back, back.x + 15, back.y + 15,
                                               SUNO_FRAME_LIGHT, true) == 0xffde3b3du);
                assert(Suno_frame_button_pixel(back, back.x - 5, back.y - 5,
                                               SUNO_FRAME_LIGHT, true) == 0);
            } else {
                assert(Suno_frame_resize_edge(f, 0, 0, false) == 0);
            }
            for (int mode = SUNO_FRAME_LIGHT; mode <= SUNO_FRAME_GLASS; ++mode) {
                assert(Suno_frame_pixel_material(f, f.content.x + 25, f.content.y + 25, (SunoFrameMaterial)mode) == 0);
                assert(Suno_frame_pixel_material(f, -1, 0, (SunoFrameMaterial)mode) == 0);
                for (int y = 0; y < f.outer.height; ++y) {
                    for (int x = 0; x < f.outer.width; ++x) {
                        uint32_t pixel = Suno_frame_pixel_material(f, x, y, (SunoFrameMaterial)mode);
                        unsigned alpha = pixel >> 24;
                        assert(((pixel >> 16) & 255) <= alpha);
                        assert(((pixel >> 8) & 255) <= alpha);
                        assert((pixel & 255) <= alpha);
                        if (!decorated) assert(pixel == 0);
                    }
                }
            }
        }
    }
    assert(SUNO_FRAME_GLYPH_SIZE == 14);
    unsigned ink = 0;
    for (unsigned n = 0; n < 196; ++n) ink += Suno_frame_back_glyph[n];
    assert(ink > 0);
    puts("App Kit compatibility frame: widths, content isolation, premultiplied edges, handheld bypass pass");
}
