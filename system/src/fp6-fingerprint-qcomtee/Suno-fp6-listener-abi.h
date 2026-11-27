/* SPDX-License-Identifier: Apache-2.0 */
#ifndef SUNO_FP6_LISTENER_ABI_H
#define SUNO_FP6_LISTENER_ABI_H

#include <linux/ioctl.h>
#include <linux/types.h>

#define SUNO_FP6_LISTENER_ABI_VERSION 1U
struct Suno_fp6_listener_message {
	__u32 abi_version;
	__u32 listener_id;
	__u64 sequence;
	__u32 buffer_size;
	__s32 dispatch_status;
	__u64 payload_ptr;
	__u32 payload_capacity;
	__u32 reserved;
};

#define SUNO_FP6_LISTENER_IOC_MAGIC 0xf7
#define SUNO_FP6_LISTENER_IOC_WAIT \
	_IOWR(SUNO_FP6_LISTENER_IOC_MAGIC, 0x20, \
	      struct Suno_fp6_listener_message)
#define SUNO_FP6_LISTENER_IOC_RESPOND \
	_IOW(SUNO_FP6_LISTENER_IOC_MAGIC, 0x21, \
	     struct Suno_fp6_listener_message)

#endif
