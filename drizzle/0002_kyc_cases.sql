CREATE TABLE `kyc_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`case_ref` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_email` text NOT NULL,
	`risk_score` integer NOT NULL,
	`vendor_reasons_json` text NOT NULL,
	`document_url` text NOT NULL,
	`status` text NOT NULL,
	`assignee_id` text,
	`decision_reason` text,
	`decided_by` text,
	`decided_at` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
