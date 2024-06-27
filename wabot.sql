-- phpMyAdmin SQL Dump
-- version 5.1.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jun 25, 2024 at 01:11 PM
-- Server version: 10.4.19-MariaDB
-- PHP Version: 7.4.20

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `wabot`
--

-- --------------------------------------------------------

--
-- Table structure for table `chats`
--

CREATE TABLE `chats` (
  `pk_id` bigint(20) NOT NULL,
  `session_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `archived` tinyint(1) DEFAULT NULL,
  `contact_primary_identity_key` longblob DEFAULT NULL,
  `conversation_timestamp` bigint(20) DEFAULT NULL,
  `created_at` bigint(20) DEFAULT NULL,
  `created_by` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `disappearing_mode` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`disappearing_mode`)),
  `display_name` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `end_of_history_transfer` tinyint(1) DEFAULT NULL,
  `end_of_history_transfer_type` int(11) DEFAULT NULL,
  `ephemeral_expiration` int(11) DEFAULT NULL,
  `ephemeral_setting_timestamp` bigint(20) DEFAULT NULL,
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_default_subgroup` tinyint(1) DEFAULT NULL,
  `is_parent_group` tinyint(1) DEFAULT NULL,
  `last_msg_timestamp` bigint(20) DEFAULT NULL,
  `lid_jid` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `marked_as_unread` tinyint(1) DEFAULT NULL,
  `media_visibility` int(11) DEFAULT NULL,
  `messages` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`messages`)),
  `mute_end_time` bigint(20) DEFAULT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_jid` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `not_spam` tinyint(1) DEFAULT NULL,
  `old_jid` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `p_hash` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `parent_group_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `participant` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`participant`)),
  `pinned` int(11) DEFAULT NULL,
  `pn_jid` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `pnh_duplicate_lid_thread` tinyint(1) DEFAULT NULL,
  `read_only` tinyint(1) DEFAULT NULL,
  `share_own_pn` tinyint(1) DEFAULT NULL,
  `support` tinyint(1) DEFAULT NULL,
  `suspended` tinyint(1) DEFAULT NULL,
  `tc_token` longblob DEFAULT NULL,
  `tc_token_sender_timestamp` bigint(20) DEFAULT NULL,
  `tc_token_timestamp` bigint(20) DEFAULT NULL,
  `terminated` tinyint(1) DEFAULT NULL,
  `unread_count` int(11) DEFAULT NULL,
  `unread_mention_count` int(11) DEFAULT NULL,
  `wallpaper` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`wallpaper`)),
  `last_message_recv_timestamp` int(11) DEFAULT NULL,
  `comments_count` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `contacts`
--

CREATE TABLE `contacts` (
  `pk_id` bigint(20) NOT NULL,
  `session_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notify` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `verified_name` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `img_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `groups`
--

CREATE TABLE `groups` (
  `pk_id` bigint(20) NOT NULL,
  `session_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `owner` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subject` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject_owner` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subject_time` int(11) DEFAULT NULL,
  `creation` int(11) DEFAULT NULL,
  `desc` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `desc_owner` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `desc_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `restrict` tinyint(1) DEFAULT NULL,
  `announce` tinyint(1) DEFAULT NULL,
  `size` int(11) DEFAULT NULL,
  `participants` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`participants`)),
  `ephemeral_duration` int(11) DEFAULT NULL,
  `invite_code` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `messages`
--

CREATE TABLE `messages` (
  `pk_id` bigint(20) NOT NULL,
  `session_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `remote_jid` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `agent_id` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `biz_privacy_status` int(11) DEFAULT NULL,
  `broadcast` tinyint(1) DEFAULT NULL,
  `clear_media` tinyint(1) DEFAULT NULL,
  `duration` int(11) DEFAULT NULL,
  `ephemeral_duration` int(11) DEFAULT NULL,
  `ephemeral_off_to_on` tinyint(1) DEFAULT NULL,
  `ephemeral_out_of_sync` tinyint(1) DEFAULT NULL,
  `ephemeral_start_timestamp` bigint(20) DEFAULT NULL,
  `final_live_location` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`final_live_location`)),
  `futureproof_data` longblob DEFAULT NULL,
  `ignore` tinyint(1) DEFAULT NULL,
  `keep_in_chat` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`keep_in_chat`)),
  `key` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`key`)),
  `labels` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`labels`)),
  `media_ciphertext_sha256` longblob DEFAULT NULL,
  `media_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`media_data`)),
  `message` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`message`)),
  `message_c2s_timestamp` bigint(20) DEFAULT NULL,
  `message_secret` longblob DEFAULT NULL,
  `message_stub_parameters` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`message_stub_parameters`)),
  `message_stub_type` int(11) DEFAULT NULL,
  `message_timestamp` bigint(20) DEFAULT NULL,
  `multicast` tinyint(1) DEFAULT NULL,
  `original_self_author_user_jid_string` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `participant` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_info` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`payment_info`)),
  `photo_change` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`photo_change`)),
  `poll_additional_metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`poll_additional_metadata`)),
  `poll_updates` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`poll_updates`)),
  `push_name` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quoted_payment_info` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`quoted_payment_info`)),
  `quoted_sticker_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`quoted_sticker_data`)),
  `reactions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`reactions`)),
  `revoke_message_timestamp` bigint(20) DEFAULT NULL,
  `starred` tinyint(1) DEFAULT NULL,
  `status` int(11) DEFAULT NULL,
  `status_already_viewed` tinyint(1) DEFAULT NULL,
  `status_psa` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`status_psa`)),
  `url_number` tinyint(1) DEFAULT NULL,
  `url_text` tinyint(1) DEFAULT NULL,
  `user_receipt` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`user_receipt`)),
  `verified_biz_name` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `event_responses` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`event_responses`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `pk_id` bigint(20) NOT NULL,
  `session_id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `id` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `data` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `connection_status` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL DEFAULT current_timestamp(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sessions`
--

INSERT INTO `sessions` (`pk_id`, `session_id`, `id`, `data`, `connection_status`, `created_at`, `updated_at`) VALUES
(1, 'john', 'session-config-john', '{\"sessionId\":\"john\",\"socketConfig\":{},\"usePairingCode\":false}', NULL, '2024-06-25 11:11:04.047', '2024-06-25 11:11:04.047');

-- --------------------------------------------------------

--
-- Table structure for table `_prisma_migrations`
--

CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logs` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `applied_steps_count` int(10) UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `_prisma_migrations`
--

INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`) VALUES
('65fe2a3e-9380-42e0-b3d2-058f3c477de7', '6a66db3fe1263da4ec2de4ded4fb8ea3f97851cb830040517859882513097f6a', '2024-06-25 11:08:03.208', '20240625110803_wabot', NULL, NULL, '2024-06-25 11:08:03.075', 1);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `chats`
--
ALTER TABLE `chats`
  ADD PRIMARY KEY (`pk_id`),
  ADD UNIQUE KEY `unique_id_per_session_id_chat` (`session_id`,`id`),
  ADD KEY `chats_session_id_idx` (`session_id`);

--
-- Indexes for table `contacts`
--
ALTER TABLE `contacts`
  ADD PRIMARY KEY (`pk_id`),
  ADD UNIQUE KEY `unique_id_per_session_id_contact` (`session_id`,`id`),
  ADD KEY `contacts_session_id_idx` (`session_id`);

--
-- Indexes for table `groups`
--
ALTER TABLE `groups`
  ADD PRIMARY KEY (`pk_id`),
  ADD UNIQUE KEY `unique_id_per_session_id_group` (`session_id`,`id`),
  ADD KEY `groups_session_id_idx` (`session_id`);

--
-- Indexes for table `messages`
--
ALTER TABLE `messages`
  ADD PRIMARY KEY (`pk_id`),
  ADD UNIQUE KEY `unique_message_key_per_session_id` (`session_id`,`remote_jid`,`id`),
  ADD KEY `messages_session_id_idx` (`session_id`);

--
-- Indexes for table `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`pk_id`),
  ADD UNIQUE KEY `unique_id_per_session_id_session` (`session_id`,`id`),
  ADD KEY `sessions_session_id_idx` (`session_id`);

--
-- Indexes for table `_prisma_migrations`
--
ALTER TABLE `_prisma_migrations`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `chats`
--
ALTER TABLE `chats`
  MODIFY `pk_id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `contacts`
--
ALTER TABLE `contacts`
  MODIFY `pk_id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `groups`
--
ALTER TABLE `groups`
  MODIFY `pk_id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `messages`
--
ALTER TABLE `messages`
  MODIFY `pk_id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sessions`
--
ALTER TABLE `sessions`
  MODIFY `pk_id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
