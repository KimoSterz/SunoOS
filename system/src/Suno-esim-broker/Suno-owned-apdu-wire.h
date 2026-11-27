/* SPDX-License-Identifier: MIT */
/* Suno private inherited-FD transport, SOURCE candidate, not enabled. */
#pragma once
#include <stdint.h>
#define SUNO_APDU_MAGIC UINT32_C(0x4c415031)
#define SUNO_APDU_MAX 65538u
#define SUNO_APDU_CALLS 512u
enum Suno_apdu_operation { SUNO_CONNECT=1, SUNO_OPEN=2, SUNO_TRANSMIT=3,
                           SUNO_CLOSE=4, SUNO_DISCONNECT=5 };
/* Four big-endian uint32 fields. Requests: magic, sequence, operation, length.
 * Responses: magic, sequence, result (0 success, 1 failure), length.
 * SOCK_SEQPACKET preserves one bounded header+payload per request/response.
 * Open response payload is one owner-issued channel byte; close must repeat it.
 * APDU bytes and secrets never enter logs, argv or public bus messages. */
#define SUNO_APDU_HEADER 16u
static inline uint32_t Suno_wire_get(const uint8_t *p) {
    return ((uint32_t)p[0]<<24)|((uint32_t)p[1]<<16)|((uint32_t)p[2]<<8)|p[3];
}
static inline void Suno_wire_put(uint8_t *p,uint32_t v) {
    p[0]=(uint8_t)(v>>24);p[1]=(uint8_t)(v>>16);p[2]=(uint8_t)(v>>8);p[3]=(uint8_t)v;
}
