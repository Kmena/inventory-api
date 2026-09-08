-- in-app-feedback feature: create feedback table (DEC-002, DEC-004)
-- No FK to User or Company — denormalized for audit resilience.
-- feedback.id is Int (serial) — not BigInt (DEC-004).

CREATE TABLE "feedback" (
  "id"          SERIAL         NOT NULL,
  "rating"      INTEGER        NOT NULL,
  "category"    VARCHAR(20)    NOT NULL,
  "comment"     TEXT           NOT NULL,
  "improvement" TEXT,
  "context"     VARCHAR(20)    NOT NULL,
  "route"       VARCHAR(500),
  "user_email"  VARCHAR(255),
  "user_name"   VARCHAR(255),
  "company_id"  INTEGER,
  "resolved"    BOOLEAN        NOT NULL DEFAULT false,
  "resolved_at" TIMESTAMPTZ,
  "created_at"  TIMESTAMPTZ    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "feedback_resolved_idx"    ON "feedback" ("resolved");
CREATE INDEX "feedback_created_at_idx"  ON "feedback" ("created_at" DESC);
CREATE INDEX "feedback_company_id_idx"  ON "feedback" ("company_id");
