# API disponible en esta entrega

Inventario generado por `node scripts/document-api.cjs`. La presencia de un método no demuestra que WhatsApp lo autorice para tu cuenta.

## Métodos del socket

- `addChatLabel`
- `addLabel`
- `addMessageLabel`
- `addOrEditContact`
- `addOrEditQuickReply`
- `appPatch`
- `assertSessions`
- `chatModify`
- `cleanDirtyBits`
- `clearMessage`
- `communityAcceptInvite`
- `communityAcceptInviteV4`
- `communityCreate`
- `communityCreateGroup`
- `communityFetchAllParticipating`
- `communityFetchLinkedGroups`
- `communityGetInviteInfo`
- `communityInviteCode`
- `communityJoinApprovalMode`
- `communityLeave`
- `communityLinkGroup`
- `communityMemberAddMode`
- `communityMetadata`
- `communityParticipantsUpdate`
- `communityQuery`
- `communityRequestParticipantsList`
- `communityRequestParticipantsUpdate`
- `communityRevokeInvite`
- `communityRevokeInviteV4`
- `communitySettingUpdate`
- `communityToggleEphemeral`
- `communityUnlinkGroup`
- `communityUpdateDescription`
- `communityUpdateSubject`
- `createCallLink`
- `createParticipantNodes`
- `digestKeyBundle`
- `downloadConsentedViewOnce`
- `downloadNormalMedia`
- `downloadViewOnceMessage`
- `enableEventTracking`
- `enableMediaAutomation`
- `enableStatusTracking`
- `end`
- `executeUSyncQuery`
- `executeWMexQuery`
- `exportReceivedStatuses`
- `fetchAccountReachoutTimelock`
- `fetchBlocklist`
- `fetchDisappearingDuration`
- `fetchMessageHistory`
- `fetchNewChatMessageCap`
- `fetchPrivacySettings`
- `fetchStatus`
- `findUserId`
- `generateMessageTag`
- `getBotListV2`
- `getBusinessProfile`
- `getCatalog`
- `getCollections`
- `getCountryForJid`
- `getEphemeralGroup`
- `getLidUser`
- `getMediaHost`
- `getMessageDiagnostics`
- `getOrderDetails`
- `getPrivacyTokens`
- `getReceivedStatuses`
- `getUSyncDevices`
- `getViewOnceContent`
- `groupAcceptInvite`
- `groupAcceptInviteV4`
- `groupCreate`
- `groupFetchAllParticipating`
- `groupGetInviteInfo`
- `groupInviteCode`
- `groupJoinApprovalMode`
- `groupLeave`
- `groupMemberAddMode`
- `groupMetadata`
- `groupParticipantsUpdate`
- `groupQuery`
- `groupRequestParticipantsList`
- `groupRequestParticipantsUpdate`
- `groupRevokeInvite`
- `groupRevokeInviteV4`
- `groupSettingUpdate`
- `groupToggleEphemeral`
- `groupUpdateDescription`
- `groupUpdateSubject`
- `handleAutoViewOnce`
- `inspectMessage`
- `issuePrivacyTokens`
- `logout`
- `newsletterAdminCount`
- `newsletterChangeOwner`
- `newsletterCreate`
- `newsletterDelete`
- `newsletterDemote`
- `newsletterFetchMessages`
- `newsletterFetchUpdates`
- `newsletterFollow`
- `newsletterMetadata`
- `newsletterMute`
- `newsletterReactMessage`
- `newsletterReactionMode`
- `newsletterRemovePicture`
- `newsletterSubscribed`
- `newsletterSubscribers`
- `newsletterUnfollow`
- `newsletterUnmute`
- `newsletterUpdate`
- `newsletterUpdateDescription`
- `newsletterUpdateName`
- `newsletterUpdatePicture`
- `normalizeViewOnceMessage`
- `offerCall`
- `onUnexpectedError`
- `onWhatsApp`
- `presenceSubscribe`
- `productCreate`
- `productDelete`
- `productUpdate`
- `profilePictureUrl`
- `query`
- `readMessages`
- `refreshMediaConn`
- `refreshReceivedStatuses`
- `registerSocketEndHandler`
- `rejectCall`
- `relayMessage`
- `removeChatLabel`
- `removeContact`
- `removeCoverPhoto`
- `removeMessageLabel`
- `removeProfilePicture`
- `removeQuickReply`
- `requestPairingCode`
- `requestPlaceholderResend`
- `resendViewOnceMessage`
- `resyncAppState`
- `rotateSignedPreKey`
- `saveConsentedViewOnce`
- `saveNormalMedia`
- `saveReceivedStatus`
- `sendAIResponse`
- `sendMessage`
- `sendMessageAck`
- `sendNode`
- `sendPeerDataOperationMessage`
- `sendPresenceUpdate`
- `sendRawMessage`
- `sendReceipt`
- `sendReceipts`
- `sendRetryRequest`
- `sendStatusMentions`
- `sendUnifiedSession`
- `sendWAMBuffer`
- `star`
- `subscribeNewsletterUpdates`
- `updateBlockStatus`
- `updateBusinessProfile`
- `updateBussinesProfile`
- `updateCallPrivacy`
- `updateCoverPhoto`
- `updateDefaultDisappearingMode`
- `updateDisableLinkPreviewsPrivacy`
- `updateGroupsAddPrivacy`
- `updateLastSeenPrivacy`
- `updateMediaMessage`
- `updateMemberLabel`
- `updateMessagesPrivacy`
- `updateOnlinePrivacy`
- `updateProfileName`
- `updateProfilePicture`
- `updateProfilePicturePrivacy`
- `updateProfileStatus`
- `updateReadReceiptsPrivacy`
- `updateServerTimeOffset`
- `updateStatusPrivacy`
- `uploadPreKeys`
- `uploadPreKeysToServerIfRequired`
- `upsertMessage`
- `waUploadToServer`
- `waitForConnectionUpdate`
- `waitForMessage`
- `waitForSocketOpen`

## Exportaciones públicas

| Exportación | Tipo |
| --- | --- |
| `ACCOUNT_RESTRICTED_TEXT` | string |
| `AIRich` | function |
| `ALL_WA_PATCH_NAMES` | object |
| `ActiveCall` | function |
| `AssociationType` | object |
| `BASH_KEYWORDS` | object |
| `BIZ_BOT_SUPPORT_PAYLOAD` | string |
| `BinaryInfo` | function |
| `Browsers` | function |
| `BufferJSON` | object |
| `Button` | function |
| `ButtonHeaderType` | object |
| `ButtonType` | object |
| `ButtonV2` | function |
| `CALL_AUDIO_PREFIX` | string |
| `CALL_VIDEO_PREFIX` | string |
| `CallState` | object |
| `Carousel` | function |
| `CarouselCardType` | object |
| `CodeHighlightType` | object |
| `CompanionWebClientType` | object |
| `Curve` | object |
| `DECRYPTION_RETRY_CONFIG` | object |
| `DEFAULT_CACHE_TTLS` | object |
| `DEFAULT_CONNECTION_CONFIG` | object |
| `DEFAULT_ORIGIN` | string |
| `DEF_CALLBACK_PREFIX` | string |
| `DEF_MEDIA_HOST` | string |
| `DEF_TAG_PREFIX` | string |
| `DICT_VERSION` | number |
| `DONATE_URL` | string |
| `DisconnectReason` | object |
| `Dugong` | function |
| `FLAG_BYTE` | number |
| `FLAG_EVENT` | number |
| `FLAG_EXTENDED` | number |
| `FLAG_FIELD` | number |
| `FLAG_GLOBAL` | number |
| `GO_KEYWORDS` | object |
| `HISTORY_SYNC_PAUSED_TIMEOUT_MS` | number |
| `INITIAL_PREKEY_COUNT` | number |
| `Itsuki` | function |
| `JS_KEYWORDS` | object |
| `KAGE_BUILD` | object |
| `KEY_BUNDLE_TYPE` | object |
| `LANGUAGE_KEYWORDS` | object |
| `LEXER_REGEX` | object |
| `LIBRARY_NAME` | string |
| `LIDMappingStore` | function |
| `LT_HASH_ANTI_TAMPERING` | object |
| `LUA_KEYWORDS` | object |
| `ListType` | object |
| `MAX_SYNC_ATTEMPTS` | number |
| `MEDIA_HKDF_KEY_MAPPING` | object |
| `MEDIA_KEYS` | object |
| `MEDIA_PATH_MAP` | object |
| `MEDIA_RETRY_STATUS_MAP` | object |
| `META_AI_JID` | string |
| `MIN_PREKEY_COUNT` | number |
| `MIN_UPLOAD_INTERVAL` | number |
| `MISSING_KEYS_ERROR_TEXT` | string |
| `MessageRetryManager` | function |
| `MexOperations` | object |
| `MexUpdatesOperations` | object |
| `NACK_REASONS` | object |
| `NEWSLETTER_MEDIA_PATH_MAP` | object |
| `NOISE_MODE` | string |
| `NOISE_WA_HEADER` | object |
| `NO_MESSAGE_FOUND_ERROR_TEXT` | string |
| `NewChatMessageCappingMVStatusType` | object |
| `NewChatMessageCappingOTEStatusType` | object |
| `NewChatMessageCappingStatusType` | object |
| `OFFICIAL_BIZ_JID` | string |
| `ORich` | function |
| `ObjectRepository` | function |
| `PHONENUMBER_MCC` | object |
| `PHONE_CONNECTION_CB` | string |
| `PLACEHOLDER_MAX_AGE_SECONDS` | number |
| `PROCESSABLE_HISTORY_TYPES` | object |
| `PSA_WID` | string |
| `PYTHON_KEYWORDS` | object |
| `PreKeyManager` | function |
| `ProtocolType` | object |
| `QueryIds` | object |
| `ReachoutTimelockEnforcementType` | object |
| `RetryReason` | object |
| `RichSubMessageType` | object |
| `SERVER_ERROR_CODES` | object |
| `SERVER_JID` | string |
| `STATUS_EXPIRY_SECONDS` | number |
| `STORIES_JID` | string |
| `S_WHATSAPP_NET` | string |
| `SyncState` | object |
| `TC_TOKEN_INDEX_KEY` | string |
| `TEXT_DECODER` | object |
| `TEXT_ENCODER` | object |
| `TimeMs` | object |
| `Toolkit` | function |
| `UNAUTHORIZED_CODES` | object |
| `UPLOAD_TIMEOUT` | number |
| `URL_REGEX` | object |
| `USyncBotProfileProtocol` | function |
| `USyncContactProtocol` | function |
| `USyncDeviceProtocol` | function |
| `USyncDisappearingModeProtocol` | function |
| `USyncLIDProtocol` | function |
| `USyncQuery` | function |
| `USyncStatusProtocol` | function |
| `USyncUser` | function |
| `USyncUsernameProtocol` | function |
| `VERSION` | string |
| `VoipClient` | function |
| `WAJIDDomains` | object |
| `WAMessageAddressingMode` | object |
| `WAMessageStatus` | object |
| `WAMessageStubType` | object |
| `WAProto` | object |
| `WA_ADV_ACCOUNT_SIG_PREFIX` | object |
| `WA_ADV_DEVICE_SIG_PREFIX` | object |
| `WA_ADV_HOSTED_ACCOUNT_SIG_PREFIX` | object |
| `WA_ADV_HOSTED_DEVICE_SIG_PREFIX` | object |
| `WA_CERT_DETAILS` | object |
| `WA_DEFAULT_EPHEMERAL` | number |
| `WEB_EVENTS` | object |
| `WEB_GLOBALS` | object |
| `XWAPaths` | object |
| `XWAPathsMexUpdates` | object |
| `addTransactionCapability` | function |
| `aesDecrypt` | function |
| `aesDecryptCTR` | function |
| `aesDecryptGCM` | function |
| `aesDecryptWithIV` | function |
| `aesEncrypWithIV` | function |
| `aesEncrypt` | function |
| `aesEncryptCTR` | function |
| `aesEncryptGCM` | function |
| `aggregateMessageKeysNotFromMe` | function |
| `areJidsSameUser` | function |
| `asciiDecode` | function |
| `asciiEncode` | function |
| `assertMeId` | function |
| `assertMediaContent` | function |
| `assertNodeErrorFree` | function |
| `binaryNodeToString` | function |
| `bindWaitForConnectionUpdate` | function |
| `bindWaitForEvent` | function |
| `botMetadataCertificate` | function |
| `botMetadataSignature` | function |
| `buildAckStanza` | function |
| `buildBotForwardedMessage` | function |
| `buildMergedTcTokenIndexWrite` | function |
| `buildPairingQRData` | function |
| `buildRichContextInfo` | function |
| `buildTcTokenFromJid` | function |
| `bytesToCrockford` | function |
| `captureEventStream` | function |
| `captureStatus` | function |
| `captureUnifiedResponse` | function |
| `cargarExtrasKage` | function |
| `chatModificationToAppPatch` | function |
| `cleanMessage` | function |
| `clearStatuses` | function |
| `configureSuccessfulPairing` | function |
| `createSignalIdentity` | function |
| `debouncedTimeout` | function |
| `decodeBinaryNode` | function |
| `decodeDecompressedBinaryNode` | function |
| `decodeMediaRetryNode` | function |
| `decodeMessageNode` | function |
| `decodePatches` | function |
| `decodeSyncdMutations` | function |
| `decodeSyncdPatch` | function |
| `decodeSyncdSnapshot` | function |
| `decompressingIfRequired` | function |
| `decryptComment` | function |
| `decryptEventEdit` | function |
| `decryptEventResponse` | function |
| `decryptMediaRetryData` | function |
| `decryptMessageEdit` | function |
| `decryptMessageNode` | function |
| `decryptPollVote` | function |
| `decryptReaction` | function |
| `default` | function |
| `delay` | function |
| `delayCancellable` | function |
| `derivePairingCodeKey` | function |
| `downloadAndProcessHistorySyncNotification` | function |
| `downloadConsentedViewOnce` | function |
| `downloadContentFromMessage` | function |
| `downloadEncryptedContent` | function |
| `downloadExternalBlob` | function |
| `downloadExternalPatch` | function |
| `downloadHistory` | function |
| `downloadMediaMessage` | function |
| `downloadNormalMedia` | function |
| `downloadViewOnceMessage` | function |
| `emitSyncActionResults` | function |
| `encodeBase64EncodedStringForUpload` | function |
| `encodeBigEndian` | function |
| `encodeBinaryNode` | function |
| `encodeNewsletterMessage` | function |
| `encodeSignedDeviceIdentity` | function |
| `encodeSyncdPatch` | function |
| `encodeWAM` | function |
| `encodeWAMessage` | function |
| `encryptMediaRetryRequest` | function |
| `encryptedStream` | function |
| `ensureLTHashStateVersion` | function |
| `executeWMexQuery` | function |
| `exportStatusZip` | function |
| `extensionForMediaMessage` | function |
| `extractAddressingContext` | function |
| `extractCommunityMetadata` | function |
| `extractDeviceJids` | function |
| `extractE2ESessionFromRetryReceipt` | function |
| `extractImageThumb` | function |
| `extractMessageContent` | function |
| `extractSyncdPatches` | function |
| `extractUrlFromText` | function |
| `extractVideoThumb` | function |
| `fetchLatestBaileysVersion` | function |
| `fetchLatestKageVersion` | function |
| `fetchLatestWaWebVersion` | function |
| `findStatus` | function |
| `flushStatuses` | function |
| `fromUnicodeEscape` | function |
| `generateCodeBlockContent` | function |
| `generateCodeBlockContentV2` | function |
| `generateForwardMessageContent` | function |
| `generateLatexContent` | function |
| `generateLatexImageContent` | function |
| `generateLatexInlineImageContent` | function |
| `generateLinkContent` | function |
| `generateLinkContentV2` | function |
| `generateLinkPreviewIfRequired` | function |
| `generateListContent` | function |
| `generateLoginNode` | function |
| `generateMdTagPrefix` | function |
| `generateMessageID` | function |
| `generateMessageIDV2` | function |
| `generateOrGetPreKeys` | function |
| `generateParticipantHashV2` | function |
| `generateProfilePicture` | function |
| `generateRegistrationId` | function |
| `generateRegistrationNode` | function |
| `generateRichMessageContent` | function |
| `generateSignalPubKey` | function |
| `generateTableContent` | function |
| `generateTableContentV2` | function |
| `generateThumbnail` | function |
| `generateUnifiedResponseContent` | function |
| `generateWAMessage` | function |
| `generateWAMessageContent` | function |
| `generateWAMessageFromContent` | function |
| `getAggregateResponsesInEventMessage` | function |
| `getAggregateVotesInPollMessage` | function |
| `getAllBinaryNodeChildren` | function |
| `getAudioData` | function |
| `getAudioDuration` | function |
| `getAudioWaveform` | function |
| `getBinaryFilteredBizBot` | function |
| `getBinaryFilteredButtons` | function |
| `getBinaryNodeChild` | function |
| `getBinaryNodeChildBuffer` | function |
| `getBinaryNodeChildString` | function |
| `getBinaryNodeChildUInt` | function |
| `getBinaryNodeChildren` | function |
| `getBinaryNodeMessages` | function |
| `getBizBinaryNode` | function |
| `getBotJid` | function |
| `getCallStatusFromNode` | function |
| `getChatId` | function |
| `getCodeFromWSError` | function |
| `getCompanionPlatformId` | function |
| `getCompanionWebClientType` | function |
| `getContentType` | function |
| `getCountryForJid` | function |
| `getCountryInfo` | function |
| `getDecryptionJid` | function |
| `getDevice` | function |
| `getErrorCodeFromStreamError` | function |
| `getHistoryMsg` | function |
| `getHttpStream` | function |
| `getImageProcessingLibrary` | function |
| `getKeyAuthor` | function |
| `getMediaKeys` | function |
| `getMediaRetryKey` | function |
| `getMessageDiagnostics` | function |
| `getMessageReportingToken` | function |
| `getNextPreKeys` | function |
| `getNextPreKeysNode` | function |
| `getPlatformId` | function |
| `getPreKeys` | function |
| `getRawMediaUploadData` | function |
| `getSenderLid` | function |
| `getServerFromDomainType` | function |
| `getStatusCodeForMediaRetry` | function |
| `getStatusFromReceiptType` | function |
| `getStream` | function |
| `getUrlFromDirectPath` | function |
| `getUrlInfo` | function |
| `getViewOnceContent` | function |
| `getWAUploadToServer` | function |
| `handleAutoMedia` | function |
| `handleAutoViewOnce` | function |
| `handleConsentedAutoViewOnce` | function |
| `handleIdentityChange` | function |
| `handleStatus` | function |
| `handleStatusArchive` | function |
| `hasAdvancedMessageOptions` | function |
| `hasNonNullishProperty` | function |
| `hasOptionalProperty` | function |
| `hasValidAlbumMedia` | function |
| `hasValidCarouselHeader` | function |
| `hasValidInteractiveHeader` | function |
| `hkdf` | function |
| `hkdfInfoKey` | function |
| `hmacSign` | function |
| `initAuthCreds` | function |
| `inspectMessage` | function |
| `installKageTools` | function |
| `installMessageInspector` | function |
| `isAppStateSyncIrrecoverable` | function |
| `isHostedLidUser` | function |
| `isHostedPnUser` | function |
| `isJidBot` | function |
| `isJidBroadcast` | function |
| `isJidGroup` | function |
| `isJidMetaAI` | function |
| `isJidMetaAi` | function |
| `isJidNewsletter` | function |
| `isJidStatusBroadcast` | function |
| `isJidUser` | function |
| `isKnownStatusContact` | function |
| `isLidUser` | function |
| `isMissingKeyError` | function |
| `isPnUser` | function |
| `isRealMessage` | function |
| `isStringNullOrEmpty` | function |
| `isTcTokenExpired` | function |
| `isWABusinessPlatform` | function |
| `jidDecode` | function |
| `jidEncode` | function |
| `jidNormalizedUser` | function |
| `lidToJid` | function |
| `listStatuses` | function |
| `makeCacheManagerAuthState` | function |
| `makeCacheableSignalKeyStore` | function |
| `makeCommunitiesSocket` | function |
| `makeEventBuffer` | function |
| `makeInMemoryStore` | function |
| `makeLtHashGenerator` | function |
| `makeNoiseHandler` | function |
| `makeOfflineNodeProcessor` | function |
| `makeOrderedDictionary` | function |
| `makeStickerPack` | function |
| `makeWASocket` | function |
| `markStatusDeleted` | function |
| `markViewOnce` | function |
| `md5` | function |
| `mediaMessageSHA256B64` | function |
| `mutationKeys` | function |
| `newLTHashState` | function |
| `normalizeEventMessage` | function |
| `normalizeMessageContent` | function |
| `normalizeViewOnceMessage` | function |
| `parseAndInjectE2ESessions` | function |
| `prepareAlbumMessageContent` | function |
| `prepareConsentedViewOnce` | function |
| `prepareDisappearingMessageSettingContent` | function |
| `prepareEventMessage` | function |
| `prepareRichResponseMessage` | function |
| `prepareStream` | function |
| `prepareWAMessageMedia` | function |
| `printQRIfNecessaryListener` | function |
| `processContactAction` | function |
| `processHistoryMessage` | function |
| `processMessage` | function |
| `processSyncAction` | function |
| `promiseTimeout` | function |
| `proto` | object |
| `readAndEmitEventStream` | function |
| `readTcTokenIndex` | function |
| `reduceBinaryNodeToDictionary` | function |
| `refreshReceivedStatuses` | function |
| `rememberMessage` | function |
| `resendViewOnceMessage` | function |
| `resolveIssuanceJid` | function |
| `resolveTcTokenJid` | function |
| `saveConsentedViewOnce` | function |
| `saveNormalMedia` | function |
| `saveReceivedStatus` | function |
| `say` | function |
| `sendAIResponse` | function |
| `sha256` | function |
| `shouldIncludeBizBinaryNode` | function |
| `shouldIncludeReportingToken` | function |
| `shouldIncrementChatUnread` | function |
| `shouldSendNewTcToken` | function |
| `showKageBanner` | function |
| `signedKeyPair` | function |
| `statusContent` | function |
| `storeTcTokensFromIqResult` | function |
| `suppliedProto` | object |
| `toBuffer` | function |
| `toJid` | function |
| `toNumber` | function |
| `toReadable` | function |
| `toTableMetadataV2` | function |
| `toUnicodeEscape` | function |
| `toUnified` | function |
| `tokenizeCode` | function |
| `tokenizeCodeV2` | function |
| `transferDevice` | function |
| `trimUndefined` | function |
| `unixTimestampSeconds` | function |
| `unpadRandomMax16` | function |
| `unwrapNormalMedia` | function |
| `updateMessageWithEventResponse` | function |
| `updateMessageWithPollUpdate` | function |
| `updateMessageWithReaction` | function |
| `updateMessageWithReceipt` | function |
| `uploadFile` | function |
| `uploadWithNodeHttp` | function |
| `useMultiFileAuthState` | function |
| `useSingleFileAuthState` | function |
| `useSqliteAuthState` | function |
| `version` | object |
| `vid2jpg` | function |
| `waChatKey` | function |
| `waLabelAssociationKey` | object |
| `waMessageID` | function |
| `wrapToBotForwardedMessage` | function |
| `writeRandomPadMax16` | function |
| `xmppPreKey` | function |
| `xmppSignedPreKey` | function |

## Nombres del README histórico no presentes en el socket

- `getBroadcastListInfo` — no usar como método del socket de esta distribución. Puede ser un helper de ejemplo o una API no incluida.
