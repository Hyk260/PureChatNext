CREATE TABLE "User" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"password" varchar(64),
	"login_id" varchar(32) NOT NULL,
	"nick_name" varchar(64),
	"avatar_url" text,
	"phone" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "User_email_unique" UNIQUE("email"),
	CONSTRAINT "User_login_id_unique" UNIQUE("login_id"),
	CONSTRAINT "User_phone_unique" UNIQUE("phone")
);
