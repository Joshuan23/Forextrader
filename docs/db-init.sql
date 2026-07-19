-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('long', 'short');

-- CreateEnum
CREATE TYPE "SignalGrade" AS ENUM ('A', 'B', 'C', 'blocked');

-- CreateEnum
CREATE TYPE "SignalStatus" AS ENUM ('active', 'invalid', 'hit_tp1', 'hit_tp2', 'stopped', 'expired', 'blocked');

-- CreateEnum
CREATE TYPE "SessionTag" AS ENUM ('asia', 'london', 'newyork', 'london_ny_overlap', 'asia_london_overlap', 'dead_zone');

-- CreateEnum
CREATE TYPE "RegimeTag" AS ENUM ('trending_up', 'trending_down', 'ranging', 'volatile_expansion', 'quiet');

-- CreateEnum
CREATE TYPE "EventImpact" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "MacroRiskLevel" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "SetupType" AS ENUM ('pullback_continuation', 'breakout_retest', 'liquidity_sweep_reversal', 'range_fade', 'orderblock_mitigation');

-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('market', 'limit', 'stop');

-- CreateTable
CREATE TABLE "Pair" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "assetClass" TEXT NOT NULL DEFAULT 'forex',
    "digits" INTEGER NOT NULL,
    "pipSize" DOUBLE PRECISION NOT NULL,
    "typicalSpread" DOUBLE PRECISION NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candle" (
    "id" TEXT NOT NULL,
    "pairId" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Candle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EconomicEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "impact" "EventImpact" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "forecast" TEXT,
    "previous" TEXT,
    "actual" TEXT,
    "isCentralBank" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EconomicEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "pairId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'engine',
    "timeframe" TEXT NOT NULL,
    "direction" "Direction" NOT NULL,
    "entryType" "EntryType" NOT NULL DEFAULT 'limit',
    "setupType" "SetupType" NOT NULL,
    "profileId" TEXT NOT NULL DEFAULT 'intraday-swing',
    "entry" DOUBLE PRECISION NOT NULL,
    "stopLoss" DOUBLE PRECISION NOT NULL,
    "takeProfit1" DOUBLE PRECISION NOT NULL,
    "takeProfit2" DOUBLE PRECISION NOT NULL,
    "takeProfit3" DOUBLE PRECISION,
    "riskReward" DOUBLE PRECISION NOT NULL,
    "confidenceScore" INTEGER NOT NULL,
    "grade" "SignalGrade" NOT NULL,
    "regimeTag" "RegimeTag" NOT NULL,
    "sessionTag" "SessionTag" NOT NULL,
    "spreadAtSignal" DOUBLE PRECISION NOT NULL,
    "atrAtSignal" DOUBLE PRECISION NOT NULL,
    "htfBias" TEXT NOT NULL,
    "eventRiskStatus" "MacroRiskLevel" NOT NULL,
    "status" "SignalStatus" NOT NULL DEFAULT 'active',
    "explanation" TEXT NOT NULL,
    "blockReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "layerScores" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradePlan" (
    "id" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "entry" DOUBLE PRECISION NOT NULL,
    "stopLoss" DOUBLE PRECISION NOT NULL,
    "takeProfit1" DOUBLE PRECISION NOT NULL,
    "takeProfit2" DOUBLE PRECISION NOT NULL,
    "takeProfit3" DOUBLE PRECISION,
    "riskReward" DOUBLE PRECISION NOT NULL,
    "invalidationLogic" TEXT NOT NULL,
    "managementPlan" TEXT NOT NULL,
    "riskPerTradePct" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "positionSizeLots" DOUBLE PRECISION,
    "checklist" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "signalId" TEXT,
    "pairId" TEXT NOT NULL,
    "direction" "Direction" NOT NULL,
    "setupType" "SetupType" NOT NULL,
    "sessionTag" "SessionTag" NOT NULL,
    "regimeTag" "RegimeTag" NOT NULL,
    "grade" "SignalGrade" NOT NULL,
    "taken" BOOLEAN NOT NULL DEFAULT true,
    "resultR" DOUBLE PRECISION,
    "resultPips" DOUBLE PRECISION,
    "entryAt" TIMESTAMP(3),
    "exitAt" TIMESTAMP(3),
    "screenshots" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mistakes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionMetric" (
    "id" TEXT NOT NULL,
    "pairId" TEXT NOT NULL,
    "sessionTag" "SessionTag" NOT NULL,
    "avgSpreadPips" DOUBLE PRECISION NOT NULL,
    "avgSlippagePips" DOUBLE PRECISION NOT NULL,
    "worstSlippagePips" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fillQuality" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PairSessionStats" (
    "id" TEXT NOT NULL,
    "pairId" TEXT NOT NULL,
    "sessionTag" "SessionTag" NOT NULL,
    "tradeCount" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectancyR" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgSpread" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgSlippage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PairSessionStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawWebhookLog" (
    "id" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceIp" TEXT,
    "valid" BOOLEAN NOT NULL,
    "error" TEXT,
    "payload" JSONB NOT NULL,

    CONSTRAINT "RawWebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "pairWhitelist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxSpreadPips" JSONB NOT NULL,
    "minAtrPips" DOUBLE PRECISION NOT NULL DEFAULT 6,
    "maxAtrMultiple" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "minRiskReward" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "activeProfileId" TEXT NOT NULL DEFAULT 'intraday-swing',
    "sessionFilters" JSONB NOT NULL,
    "newsBlackoutBeforeMin" INTEGER NOT NULL DEFAULT 30,
    "newsBlackoutAfterMin" INTEGER NOT NULL DEFAULT 15,
    "centralBankDowngrade" BOOLEAN NOT NULL DEFAULT true,
    "riskPerTradePct" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "accountCcy" TEXT NOT NULL DEFAULT 'USD',
    "accountSize" DOUBLE PRECISION NOT NULL DEFAULT 100000,
    "minConfidence" INTEGER NOT NULL DEFAULT 50,
    "signalWeights" JSONB NOT NULL,
    "brokerAssumptions" JSONB NOT NULL,
    "apiKeys" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "setupTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weights" JSONB NOT NULL,
    "minGrade" "SignalGrade" NOT NULL DEFAULT 'B',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrategyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pair_symbol_key" ON "Pair"("symbol");

-- CreateIndex
CREATE INDEX "Candle_pairId_timeframe_time_idx" ON "Candle"("pairId", "timeframe", "time" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Candle_pairId_timeframe_time_key" ON "Candle"("pairId", "timeframe", "time");

-- CreateIndex
CREATE INDEX "EconomicEvent_scheduledAt_idx" ON "EconomicEvent"("scheduledAt");

-- CreateIndex
CREATE INDEX "EconomicEvent_currency_scheduledAt_idx" ON "EconomicEvent"("currency", "scheduledAt");

-- CreateIndex
CREATE INDEX "Signal_status_createdAt_idx" ON "Signal"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Signal_pairId_createdAt_idx" ON "Signal"("pairId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "TradePlan_signalId_key" ON "TradePlan"("signalId");

-- CreateIndex
CREATE INDEX "JournalEntry_pairId_createdAt_idx" ON "JournalEntry"("pairId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "JournalEntry_sessionTag_idx" ON "JournalEntry"("sessionTag");

-- CreateIndex
CREATE INDEX "JournalEntry_setupType_idx" ON "JournalEntry"("setupType");

-- CreateIndex
CREATE INDEX "ExecutionMetric_pairId_sessionTag_capturedAt_idx" ON "ExecutionMetric"("pairId", "sessionTag", "capturedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PairSessionStats_pairId_sessionTag_key" ON "PairSessionStats"("pairId", "sessionTag");

-- CreateIndex
CREATE INDEX "RawWebhookLog_receivedAt_idx" ON "RawWebhookLog"("receivedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "StrategyProfile_name_key" ON "StrategyProfile"("name");

-- AddForeignKey
ALTER TABLE "Candle" ADD CONSTRAINT "Candle_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradePlan" ADD CONSTRAINT "TradePlan_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionMetric" ADD CONSTRAINT "ExecutionMetric_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PairSessionStats" ADD CONSTRAINT "PairSessionStats_pairId_fkey" FOREIGN KEY ("pairId") REFERENCES "Pair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

