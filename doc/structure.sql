CREATE TABLE `address` (
  `_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `type` tinyint(3) unsigned NOT NULL,
  `data` varbinary(32) NOT NULL,
  `string` varchar(64) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL,
  `create_height` int(10) unsigned NOT NULL,
  PRIMARY KEY (`_id`),
  UNIQUE KEY `address` (`data`,`type`),
  UNIQUE KEY `string` (`string`) USING BTREE,
  KEY `create_height` (`create_height`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `balance_change` (
  `transaction_id` bigint(20) unsigned NOT NULL,
  `block_height` int(10) unsigned NOT NULL,
  `index_in_block` int(10) unsigned NOT NULL,
  `address_id` bigint(20) unsigned NOT NULL,
  `value` bigint(20) NOT NULL,
  PRIMARY KEY (`transaction_id`,`address_id`) USING BTREE,
  UNIQUE KEY `address` (`address_id`,`block_height`,`index_in_block`,`transaction_id`,`value`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `block` (
  `hash` binary(32) NOT NULL,
  `height` int(10) unsigned NOT NULL,
  `size` int(10) unsigned NOT NULL,
  `weight` int(10) unsigned NOT NULL,
  `miner_id` bigint(20) unsigned NOT NULL,
  `delegator_id` bigint(20) unsigned DEFAULT NULL,
  `txs` int(10) unsigned NOT NULL,
  `transactions_count` int(10) unsigned NOT NULL,
  `contract_transactions_count` int(10) unsigned NOT NULL,
  `transaction_volume` bigint(20) NOT NULL,
  PRIMARY KEY (`height`),
  UNIQUE KEY `hash` (`hash`),
  KEY `miner` (`miner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `bulletin` (
  `_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `locale` varchar(10) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `priority` int(10) unsigned NOT NULL,
  PRIMARY KEY (`_id`),
  KEY `priority` (`priority`,`_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `bulletin_translation` (
  `bulletin_id` int(10) unsigned NOT NULL,
  `locale` varchar(10) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  PRIMARY KEY (`bulletin_id`,`locale`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `contract` (
  `address` binary(20) NOT NULL,
  `address_string` char(40) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL,
  `vm` enum('evm','x86') CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `type` enum('dgp','qrc20','qrc721') CHARACTER SET utf8 COLLATE utf8_general_ci DEFAULT NULL,
  `sha256_code` binary(32) NOT NULL,
  `create_receipt_id` bigint(20) unsigned DEFAULT NULL,
  `create_height` int(10) unsigned NOT NULL,
  `destruct_receipt_id` bigint(20) unsigned DEFAULT NULL,
  `destruct_height` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`address`) USING BTREE,
  UNIQUE KEY `address` (`address_string`) USING BTREE,
  KEY `bytecode` (`sha256_code`) USING BTREE,
  KEY `create_height` (`create_height`),
  KEY `destruct_height` (`destruct_height`),
  KEY `create_receipt` (`create_receipt_id`) USING BTREE,
  KEY `destruct_receipt` (`destruct_receipt_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `contract_code` (
  `sha256sum` binary(32) NOT NULL,
  `code` mediumblob NOT NULL,
  `source` longtext COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`sha256sum`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPACT;

CREATE TABLE `contract_spend` (
  `source_id` bigint(20) unsigned NOT NULL,
  `dest_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`source_id`) USING BTREE,
  KEY `dest` (`dest_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `contract_tag` (
  `_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `contract_address` binary(20) NOT NULL,
  `tag` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`_id`),
  KEY `contract` (`contract_address`),
  KEY `tag` (`tag`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPACT;

CREATE TABLE `evm_event_abi` (
  `_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id` binary(32) NOT NULL,
  `name` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `inputs` json NOT NULL,
  `anonymous` tinyint(1) NOT NULL DEFAULT '0',
  `contract_address` binary(20) DEFAULT NULL,
  `contract_tag` varchar(32) CHARACTER SET utf8 COLLATE utf8_general_ci DEFAULT NULL,
  PRIMARY KEY (`_id`),
  UNIQUE KEY `abi` (`contract_tag`,`id`) USING BTREE,
  UNIQUE KEY `contract_abi` (`contract_address`,`id`) USING BTREE,
  KEY `id` (`id`),
  KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 ROW_FORMAT=COMPACT;

CREATE TABLE `evm_function_abi` (
  `_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `id` binary(4) NOT NULL,
  `type` enum('function','constructor','fallback','') CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `name` varchar(255) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `inputs` json NOT NULL,
  `outputs` json NOT NULL,
  `state_mutability` enum('pure','view','nonpayable','payable') CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `contract_address` binary(20) DEFAULT NULL,
  `contract_tag` varchar(32) CHARACTER SET utf8 COLLATE utf8_general_ci DEFAULT NULL,
  PRIMARY KEY (`_id`),
  UNIQUE KEY `abi` (`contract_tag`,`id`) USING BTREE,
  UNIQUE KEY `contract_abi` (`contract_address`,`id`) USING BTREE,
  KEY `id` (`id`),
  KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 ROW_FORMAT=COMPACT;

CREATE TABLE `evm_receipt` (
  `_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `transaction_id` bigint(20) unsigned NOT NULL,
  `output_index` int(10) unsigned NOT NULL,
  `block_height` int(10) unsigned NOT NULL,
  `index_in_block` int(10) unsigned NOT NULL,
  `sender_type` tinyint(3) unsigned NOT NULL,
  `sender_data` varbinary(32) NOT NULL,
  `gas_used` int(10) unsigned NOT NULL,
  `contract_address` binary(20) NOT NULL,
  `excepted` varchar(32) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `excepted_message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `state_root` binary(32) NOT NULL,
  `utxo_root` binary(32) NOT NULL,
  PRIMARY KEY (`_id`),
  UNIQUE KEY `output` (`transaction_id`,`output_index`) USING BTREE,
  UNIQUE KEY `block` (`block_height`,`index_in_block`,`transaction_id`,`output_index`) USING BTREE,
  KEY `contract` (`contract_address`),
  KEY `sender` (`sender_data`,`sender_type`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 ROW_FORMAT=COMPACT;

CREATE TABLE `evm_receipt_log` (
  `_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `receipt_id` bigint(20) unsigned NOT NULL,
  `log_index` int(10) unsigned NOT NULL,
  `block_height` int(10) unsigned NOT NULL,
  `address` binary(20) NOT NULL,
  `topic1` varbinary(32) DEFAULT NULL,
  `topic2` varbinary(32) DEFAULT NULL,
  `topic3` varbinary(32) DEFAULT NULL,
  `topic4` varbinary(32) DEFAULT NULL,
  `data` blob NOT NULL,
  PRIMARY KEY (`_id`),
  UNIQUE KEY `log` (`receipt_id`,`log_index`) USING BTREE,
  KEY `block` (`block_height`),
  KEY `contract` (`address`),
  KEY `topic1` (`topic1`),
  KEY `topic2` (`topic2`),
  KEY `topic3` (`topic3`),
  KEY `topic4` (`topic4`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPACT;

CREATE TABLE `evm_receipt_log_tag` (
  `tag` varchar(32) NOT NULL,
  `log_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`tag`, `log_id`),
  KEY `log_id` (`log_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 ROW_FORMAT=COMPACT;

CREATE TABLE `evm_receipt_mapping` (
  `transaction_id` bigint(20) unsigned NOT NULL,
  `output_index` int(10) unsigned NOT NULL,
  `index_in_block` int(10) unsigned NOT NULL,
  `gas_used` int(10) unsigned NOT NULL,
  `contract_address` binary(20) NOT NULL,
  `excepted` varchar(32) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `excepted_message` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `state_root` binary(32) NOT NULL,
  `utxo_root` binary(32) NOT NULL,
  PRIMARY KEY (`transaction_id`,`output_index`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 ROW_FORMAT=COMPACT;

CREATE TABLE `feedback` (
  `_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `email_sent` boolean NOT NULL,
  PRIMARY KEY (`_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `gas_refund` (
  `transaction_id` bigint(20) unsigned NOT NULL,
  `output_index` int(10) unsigned NOT NULL,
  `refund_id` bigint(20) unsigned NOT NULL,
  `refund_index` int(10) unsigned NOT NULL,
  PRIMARY KEY (`transaction_id`,`output_index`) USING BTREE,
  UNIQUE KEY `refund` (`refund_id`,`refund_index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPACT;

CREATE TABLE `header` (
  `hash` binary(32) NOT NULL,
  `height` int(10) unsigned NOT NULL,
  `version` int(11) NOT NULL,
  `prev_hash` binary(32) NOT NULL,
  `merkle_root` binary(32) NOT NULL,
  `timestamp` int(10) unsigned NOT NULL,
  `bits` int(10) unsigned NOT NULL,
  `nonce` int(10) unsigned NOT NULL,
  `hash_state_root` binary(32) NOT NULL,
  `hash_utxo_root` binary(32) NOT NULL,
  `stake_prev_transaction_id` binary(32) NOT NULL,
  `stake_output_index` int(10) unsigned NOT NULL,
  `signature` blob NOT NULL,
  `chainwork` binary(32) NOT NULL,
  PRIMARY KEY (`height`),
  UNIQUE KEY `hash` (`hash`),
  KEY `timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `qrc20` (
  `contract_address` binary(20) NOT NULL,
  `name` blob NOT NULL,
  `symbol` blob NOT NULL,
  `decimals` tinyint(3) unsigned NOT NULL,
  `total_supply` binary(32) NOT NULL,
  PRIMARY KEY (`contract_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPACT;

CREATE TABLE `qrc20_balance` (
  `contract_address` binary(20) NOT NULL,
  `address` binary(20) NOT NULL,
  `balance` binary(32) NOT NULL,
  PRIMARY KEY (`contract_address`,`address`),
  KEY `rich_list` (`contract_address`,`balance` DESC) USING BTREE,
  KEY `address` (`address`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `qrc20_statistics` (
  `contract_address` binary(20) NOT NULL,
  `holders` int(10) unsigned NOT NULL,
  `transactions` int(10) unsigned NOT NULL,
  PRIMARY KEY (`contract_address`),
  KEY `holders` (`holders` DESC) USING BTREE,
  KEY `transactions` (`transactions` DESC) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `qrc721` (
  `contract_address` binary(20) NOT NULL,
  `name` blob NOT NULL,
  `symbol` blob NOT NULL,
  `total_supply` binary(32) NOT NULL,
  PRIMARY KEY (`contract_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPACT;

CREATE TABLE `qrc721_statistics` (
  `contract_address` binary(20) NOT NULL,
  `holders` int(10) unsigned NOT NULL,
  `transactions` int(10) unsigned NOT NULL,
  PRIMARY KEY (`contract_address`),
  KEY `holders` (`holders` DESC) USING BTREE,
  KEY `transactions` (`transactions` DESC) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `qrc721_token` (
  `contract_address` binary(20) NOT NULL,
  `token_id` binary(32) NOT NULL,
  `holder` binary(20) NOT NULL,
  PRIMARY KEY (`contract_address`,`token_id`),
  KEY `owner` (`holder`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPACT;

CREATE TABLE `qtuminfo_translation` (
  `_id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `locale` varchar(10) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `translations` json NOT NULL,
  `email` varchar(40) NOT NULL,
  `timestamp` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`_id`),
  KEY `locale` (`locale`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `rich_list` (
  `address_id` bigint(20) unsigned NOT NULL,
  `balance` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`address_id`) USING BTREE,
  KEY `balance` (`balance` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tip` (
  `service` varchar(32) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `height` int(10) unsigned NOT NULL,
  `hash` binary(32) NOT NULL,
  PRIMARY KEY (`service`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `transaction` (
  `_id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id` binary(32) NOT NULL,
  `hash` binary(32) NOT NULL,
  `version` int(11) NOT NULL,
  `flag` tinyint(3) unsigned NOT NULL,
  `lock_time` int(10) unsigned NOT NULL,
  `block_height` int(10) unsigned NOT NULL,
  `index_in_block` int(10) unsigned NOT NULL,
  `size` int(10) unsigned NOT NULL,
  `weight` int(10) unsigned NOT NULL,
  PRIMARY KEY (`_id`),
  UNIQUE KEY `id` (`id`) USING BTREE,
  UNIQUE KEY `block` (`block_height`,`index_in_block`,`_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `transaction_input` (
  `transaction_id` bigint(20) unsigned NOT NULL,
  `input_index` int(10) unsigned NOT NULL,
  `scriptsig` mediumblob NOT NULL,
  `sequence` int(10) unsigned NOT NULL,
  `block_height` int(10) unsigned NOT NULL,
  `value` bigint(20) NOT NULL,
  `address_id` bigint(20) unsigned NOT NULL,
  `output_id` bigint(20) unsigned NOT NULL,
  `output_index` int(10) unsigned NOT NULL,
  PRIMARY KEY (`transaction_id`,`input_index`) USING BTREE,
  KEY `address` (`address_id`) USING BTREE,
  KEY `height` (`block_height`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPACT;

CREATE TABLE `transaction_output` (
  `transaction_id` bigint(20) unsigned NOT NULL,
  `output_index` int(10) unsigned NOT NULL,
  `scriptpubkey` mediumblob NOT NULL,
  `block_height` int(10) unsigned NOT NULL,
  `value` bigint(20) NOT NULL,
  `address_id` bigint(20) unsigned NOT NULL,
  `is_stake` tinyint(1) NOT NULL,
  `input_id` bigint(20) unsigned NOT NULL,
  `input_index` int(10) unsigned NOT NULL,
  `input_height` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`transaction_id`,`output_index`) USING BTREE,
  KEY `height` (`block_height`) USING BTREE,
  KEY `address` (`address_id`,`input_height`,`block_height`,`value`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPACT;

CREATE TABLE `transaction_output_mapping` (
  `_id` char(32) CHARACTER SET utf8 COLLATE utf8_general_ci NOT NULL,
  `input_transaction_id` binary(32) NOT NULL,
  `input_index` int(10) unsigned NOT NULL,
  `output_transaction_id` binary(32) NOT NULL,
  `output_index` int(10) unsigned NOT NULL,
  KEY `id` (`_id`)
) ENGINE=MEMORY DEFAULT CHARSET=utf8;

CREATE TABLE `witness` (
  `transaction_id` binary(32) NOT NULL,
  `input_index` int(10) unsigned NOT NULL,
  `witness_index` int(10) unsigned NOT NULL,
  `script` blob NOT NULL,
  PRIMARY KEY (`transaction_id`,`input_index`,`witness_index`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPACT;
