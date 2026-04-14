-- Role holders — derived current state from RoleGranted / RoleRevoked events.

CREATE TABLE IF NOT EXISTS "role_holders" (
	"stable" text NOT NULL,
	"role_hash" text NOT NULL,
	"role_name" text NOT NULL,
	"holder" text NOT NULL,
	"granted_at" timestamp with time zone NOT NULL,
	"granted_tx_hash" text NOT NULL,
	"holder_type" text,
	"label" text,
	CONSTRAINT "role_holders_stable_role_hash_holder_pk" PRIMARY KEY("stable","role_hash","holder")
);

CREATE INDEX IF NOT EXISTS "role_holders_stable_idx" ON "role_holders" ("stable");
