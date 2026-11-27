// SPDX-License-Identifier: GPL-2.0-only
/*
 * One-shot FP6 QSEE application-region notification diagnostic.
 *
 * This module discovers only Suno's exact 20 MiB dedicated apps pool and
 * issues only QSEE APP_REGION_NOTIFICATION. It exposes no userspace API and
 * sends no application, sensor, biometric, enrollment, or authentication
 * command. Loading it performs the one call; unloading has no side effect.
 */

#include <linux/arm-smccc.h>
#include <linux/init.h>
#include <linux/ioport.h>
#include <linux/module.h>
#include <linux/of.h>
#include <linux/of_reserved_mem.h>
#include <linux/sizes.h>

#define SUNO_QSEE_APP_REGION_SMC_ID 0x72000105UL
#define SUNO_QSEE_APP_REGION_ARGINFO 0x22UL
#define SUNO_QSEE_INTERRUPTED 1UL
#define SUNO_QSEE_APPS_POOL_SIZE (20 * SZ_1M)

static int __init Suno_qsee_region_probe_init(void)
{
	struct arm_smccc_quirk quirk = { .id = ARM_SMCCC_QUIRK_QCOM_A6 };
	struct device_node *node;
	struct reserved_mem *memory;
	struct arm_smccc_res result;
	unsigned long call_id = SUNO_QSEE_APP_REGION_SMC_ID;

	node = of_find_node_by_path("/reserved-memory/qseecom-apps-pool");
	if (!node)
		return -ENODEV;
	memory = of_reserved_mem_lookup(node);
	of_node_put(node);
	if (!memory)
		return -ENODEV;
	if (memory->size != SUNO_QSEE_APPS_POOL_SIZE ||
	    !IS_ALIGNED(memory->base, SZ_4M) ||
	    !IS_ALIGNED(memory->size, SZ_4M) ||
	    memory->base > U32_MAX ||
	    memory->size > (u64)U32_MAX + 1 - memory->base)
		return -ERANGE;

	quirk.state.a6 = 0;
	do {
		arm_smccc_smc_quirk(call_id, SUNO_QSEE_APP_REGION_ARGINFO,
				     memory->base, memory->size, 0, 0,
				     quirk.state.a6, 0, &result, &quirk);
		if (result.a0 == SUNO_QSEE_INTERRUPTED)
			call_id = result.a0;
	} while (result.a0 == SUNO_QSEE_INTERRUPTED);

	pr_info("Suno_qsee_region: app_region transport=%#lx result=%#lx type=%#lx data=%#lx size=%llu\n",
		result.a0, result.a1, result.a2, result.a3,
		(unsigned long long)memory->size);
	if ((long)result.a0 < 0)
		return -EIO;
	if (result.a0 || result.a1)
		return -EPROTO;

	pr_info("Suno_qsee_region: app region accepted\n");
	return 0;
}

static void __exit Suno_qsee_region_probe_exit(void)
{
	pr_info("Suno_qsee_region: diagnostic unloaded\n");
}

module_init(Suno_qsee_region_probe_init);
module_exit(Suno_qsee_region_probe_exit);

MODULE_DESCRIPTION("One-shot FP6 QSEE application-region diagnostic");
MODULE_AUTHOR("Project Suno");
MODULE_LICENSE("GPL");
