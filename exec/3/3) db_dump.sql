--
-- PostgreSQL database dump
--

\restrict Rm8WZnc4XOARkUCJrT43Zx5GSlInEecHquxhKQaKTwsAdU25nrqPoNMtLjb7IKS

-- Dumped from database version 17.7 (Debian 17.7-3.pgdg13+1)
-- Dumped by pg_dump version 17.7 (Debian 17.7-3.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: car_mode; Type: TYPE; Schema: public; Owner: ssafy
--

CREATE TYPE public.car_mode AS ENUM (
    'STOP',
    'MANUAL',
    'AUTO'
);


ALTER TYPE public.car_mode OWNER TO ssafy;

--
-- Name: log_status; Type: TYPE; Schema: public; Owner: ssafy
--

CREATE TYPE public.log_status AS ENUM (
    'RUNNING',
    'STOPPED',
    'ERROR',
    'COMPLETED'
);


ALTER TYPE public.log_status OWNER TO ssafy;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: car_logs; Type: TABLE; Schema: public; Owner: ssafy
--

CREATE TABLE public.car_logs (
    id bigint NOT NULL,
    car_id bigint NOT NULL,
    map_id bigint NOT NULL,
    start_at timestamp without time zone NOT NULL,
    end_at timestamp without time zone,
    status public.log_status NOT NULL,
    detection_count integer DEFAULT 0 NOT NULL,
    owner_id bigint
);


ALTER TABLE public.car_logs OWNER TO ssafy;

--
-- Name: car_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: ssafy
--

CREATE SEQUENCE public.car_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.car_logs_id_seq OWNER TO ssafy;

--
-- Name: car_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ssafy
--

ALTER SEQUENCE public.car_logs_id_seq OWNED BY public.car_logs.id;


--
-- Name: car_status; Type: TABLE; Schema: public; Owner: ssafy
--

CREATE TABLE public.car_status (
    car_id bigint NOT NULL,
    x numeric(10,4) DEFAULT 0,
    y numeric(10,4) DEFAULT 0,
    heading real DEFAULT 0 NOT NULL,
    mode public.car_mode DEFAULT 'STOP'::public.car_mode NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


ALTER TABLE public.car_status OWNER TO ssafy;

--
-- Name: cars; Type: TABLE; Schema: public; Owner: ssafy
--

CREATE TABLE public.cars (
    id bigint NOT NULL,
    device_id character varying(64) NOT NULL,
    owner_id bigint,
    current_map_id bigint,
    claim_code character varying(32) NOT NULL,
    created_at timestamp without time zone NOT NULL,
    nickname character varying(50)
);


ALTER TABLE public.cars OWNER TO ssafy;

--
-- Name: cars_id_seq; Type: SEQUENCE; Schema: public; Owner: ssafy
--

CREATE SEQUENCE public.cars_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cars_id_seq OWNER TO ssafy;

--
-- Name: cars_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ssafy
--

ALTER SEQUENCE public.cars_id_seq OWNED BY public.cars.id;


--
-- Name: detections; Type: TABLE; Schema: public; Owner: ssafy
--

CREATE TABLE public.detections (
    id bigint NOT NULL,
    log_id bigint NOT NULL,
    label character varying(50) NOT NULL,
    confidence real NOT NULL,
    x numeric(10,4),
    y numeric(10,4),
    image_url text,
    created_at timestamp without time zone NOT NULL,
    video_url character varying(255)
);


ALTER TABLE public.detections OWNER TO ssafy;

--
-- Name: detections_id_seq; Type: SEQUENCE; Schema: public; Owner: ssafy
--

CREATE SEQUENCE public.detections_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.detections_id_seq OWNER TO ssafy;

--
-- Name: detections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ssafy
--

ALTER SEQUENCE public.detections_id_seq OWNED BY public.detections.id;


--
-- Name: maps; Type: TABLE; Schema: public; Owner: ssafy
--

CREATE TABLE public.maps (
    id bigint NOT NULL,
    car_id bigint NOT NULL,
    name character varying(50) NOT NULL,
    image_url text,
    width integer NOT NULL,
    height integer NOT NULL,
    resolution real NOT NULL,
    origin_x real NOT NULL,
    origin_y real NOT NULL,
    created_at timestamp without time zone NOT NULL,
    deleted_at timestamp without time zone,
    owner_id bigint
);


ALTER TABLE public.maps OWNER TO ssafy;

--
-- Name: maps_id_seq; Type: SEQUENCE; Schema: public; Owner: ssafy
--

CREATE SEQUENCE public.maps_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.maps_id_seq OWNER TO ssafy;

--
-- Name: maps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ssafy
--

ALTER SEQUENCE public.maps_id_seq OWNED BY public.maps.id;


--
-- Name: notification_tokens; Type: TABLE; Schema: public; Owner: ssafy
--

CREATE TABLE public.notification_tokens (
    id bigint NOT NULL,
    member_id bigint NOT NULL,
    token character varying(255) NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


ALTER TABLE public.notification_tokens OWNER TO ssafy;

--
-- Name: notification_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: ssafy
--

CREATE SEQUENCE public.notification_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notification_tokens_id_seq OWNER TO ssafy;

--
-- Name: notification_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ssafy
--

ALTER SEQUENCE public.notification_tokens_id_seq OWNED BY public.notification_tokens.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: ssafy
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    name character varying(100) NOT NULL,
    nickname character varying(100) NOT NULL,
    created_at timestamp without time zone NOT NULL
);


ALTER TABLE public.users OWNER TO ssafy;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: ssafy
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO ssafy;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ssafy
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: car_logs id; Type: DEFAULT; Schema: public; Owner: ssafy
--

ALTER TABLE ONLY public.car_logs ALTER COLUMN id SET DEFAULT nextval('public.car_logs_id_seq'::regclass);


--
-- Name: cars id; Type: DEFAULT; Schema: public; Owner: ssafy
--

ALTER TABLE ONLY public.cars ALTER COLUMN id SET DEFAULT nextval('public.cars_id_seq'::regclass);


--
-- Name: detections id; Type: DEFAULT; Schema: public; Owner: ssafy
--

ALTER TABLE ONLY public.detections ALTER COLUMN id SET DEFAULT nextval('public.detections_id_seq'::regclass);


--
-- Name: maps id; Type: DEFAULT; Schema: public; Owner: ssafy
--

ALTER TABLE ONLY public.maps ALTER COLUMN id SET DEFAULT nextval('public.maps_id_seq'::regclass);


--
-- Name: notification_tokens id; Type: DEFAULT; Schema: public; Owner: ssafy
--

ALTER TABLE ONLY public.notification_tokens ALTER COLUMN id SET DEFAULT nextval('public.notification_tokens_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: ssafy
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: car_logs; Type: TABLE DATA; Schema: public; Owner: ssafy
--

COPY public.car_logs (id, car_id, map_id, start_at, end_at, status, detection_count, owner_id) FROM stdin;
1	1	1	2026-02-09 03:56:15.040317	\N	RUNNING	2	1
\.


--
-- Data for Name: car_status; Type: TABLE DATA; Schema: public; Owner: ssafy
--

COPY public.car_status (car_id, x, y, heading, mode, updated_at) FROM stdin;
1	10.0000	20.0000	0	STOP	2026-02-09 03:56:14.912441
2	50.0000	50.0000	45	AUTO	2026-02-09 03:56:14.912441
3	0.0000	0.0000	0	STOP	2026-02-09 02:56:14.912441
\.


--
-- Data for Name: cars; Type: TABLE DATA; Schema: public; Owner: ssafy
--

COPY public.cars (id, device_id, owner_id, current_map_id, claim_code, created_at, nickname) FROM stdin;
3	unowned-car-001	\N	\N	CLAIM-3333	2026-02-09 03:56:14.912441	\N
1	my-car-001	1	\N	CLAIM-1111	2026-02-09 03:56:14.912441	내차
2	other-car-001	2	\N	CLAIM-2222	2026-02-09 03:56:14.912441	남의차
\.


--
-- Data for Name: detections; Type: TABLE DATA; Schema: public; Owner: ssafy
--

COPY public.detections (id, log_id, label, confidence, x, y, image_url, created_at, video_url) FROM stdin;
1	1	person	0.95	10.5000	20.5000	detections/1/image.jpg	2026-02-09 03:56:15.040317	\N
2	1	car	0.88	30.0000	40.0000	detections/2/image.jpg	2026-02-09 03:56:15.040317	detections/2/video.mp4
\.


--
-- Data for Name: maps; Type: TABLE DATA; Schema: public; Owner: ssafy
--

COPY public.maps (id, car_id, name, image_url, width, height, resolution, origin_x, origin_y, created_at, deleted_at, owner_id) FROM stdin;
1	1	Test Map	\N	800	600	0.05	0	0	2026-02-09 03:56:15.040317	\N	1
\.


--
-- Data for Name: notification_tokens; Type: TABLE DATA; Schema: public; Owner: ssafy
--

COPY public.notification_tokens (id, member_id, token, created_at, updated_at) FROM stdin;
1	1	DUMMY_TOKEN_USER_1	2026-02-09 03:56:15.086837	2026-02-09 03:56:15.086837
2	2	DUMMY_TOKEN_USER_2	2026-02-09 03:56:15.086837	2026-02-09 03:56:15.086837
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: ssafy
--

COPY public.users (id, email, password, name, nickname, created_at) FROM stdin;
1	test@ssafy.com	$2a$10$AGb9sfiDTnaZuaqqAhi/AefGcKWH2BE2PGusfYdMZAW5JqlN7bd5W	유저1	유저1	2026-02-09 03:56:14.984095
2	other@ssafy.com	$2a$10$rCCE3ZPYSADbRtcMBlYHYubQlKH10PxG9Fel36S6BF4j1jY/NaP8O	유저2	유저2	2026-02-09 03:56:14.984095
\.


--
-- Name: car_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ssafy
--

SELECT pg_catalog.setval('public.car_logs_id_seq', 1, true);


--
-- Name: cars_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ssafy
--

SELECT pg_catalog.setval('public.cars_id_seq', 3, true);


--
-- Name: detections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ssafy
--

SELECT pg_catalog.setval('public.detections_id_seq', 2, true);


--
-- Name: maps_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ssafy
--

SELECT pg_catalog.setval('public.maps_id_seq', 1, true);


--
-- Name: notification_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ssafy
--

SELECT pg_catalog.setval('public.notification_tokens_id_seq', 2, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ssafy
--

SELECT pg_catalog.setval('public.users_id_seq', 2, true);


--
-- Name: car_logs car_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: ssafy
--

ALTER TABLE ONLY public.car_logs
    ADD CONSTRAINT car_logs_pkey PRIMARY KEY (id);


--
-- Name: car_status car_status_pkey; Type: CONSTRAINT; Schema: public; Owner: ssafy
--

ALTER TABLE ONLY public.car_status
    ADD CONSTRAINT car_status_pkey PRIMARY KEY (car_id);


--
-- Name: cars cars_claim_code_key; Type: CONSTRAINT; Schema: public; Owner: ssafy
--

ALTER TABLE ONLY public.cars
    ADD CONSTRAINT cars_claim_code_key UNIQUE (claim_code);


--
-- Name: cars cars_device_id_key; Type: CONSTRAINT; Schema: public; Owner: ssafy
--

ALTER TABLE ONLY public.cars
    ADD CONSTRAINT cars_device_id_key UNIQUE (device_id);


--
-- Name: cars cars_pkey; Type: CONSTRAINT; Schema: public; Owner: ssafy
--

ALTER TABLE ONLY public.cars
    ADD CONSTRAINT cars_pkey PRIMARY KEY (id);


--
-- Name: detections detections_pkey; Type: CONSTRAINT; Schema: public; Owner: ssafy
--

ALTER TABLE ONLY public.detections
    ADD CONSTRAINT detections_pkey PRIMARY KEY (id);


--
-- Name: maps maps_pkey; Type: CONSTRAINT; Schema: public; Owner: ssafy
--

ALTER TABLE ONLY public.maps
    ADD CONSTRAINT maps_pkey PRIMARY KEY (id);


--
-- Name: notification_tokens notification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: ssafy
--

ALTER TABLE ONLY public.notification_tokens
    ADD CONSTRAINT notification_tokens_pkey PRIMARY KEY (id);


--
-- Name: notification_tokens notification_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: ssafy
--

ALTER TABLE ONLY public.notification_tokens
    ADD CONSTRAINT notification_tokens_token_key UNIQUE (token);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: ssafy
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: ssafy
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_car_logs_owner_id; Type: INDEX; Schema: public; Owner: ssafy
--

CREATE INDEX idx_car_logs_owner_id ON public.car_logs USING btree (owner_id);


--
-- Name: idx_maps_owner_id; Type: INDEX; Schema: public; Owner: ssafy
--

CREATE INDEX idx_maps_owner_id ON public.maps USING btree (owner_id);


--
-- Name: idx_notification_tokens_member_id; Type: INDEX; Schema: public; Owner: ssafy
--

CREATE INDEX idx_notification_tokens_member_id ON public.notification_tokens USING btree (member_id);


--
-- Name: cars fk_car_current_map; Type: FK CONSTRAINT; Schema: public; Owner: ssafy
--

ALTER TABLE ONLY public.cars
    ADD CONSTRAINT fk_car_current_map FOREIGN KEY (current_map_id) REFERENCES public.maps(id);


--
-- Name: cars fk_car_owner; Type: FK CONSTRAINT; Schema: public; Owner: ssafy
--

ALTER TABLE ONLY public.cars
    ADD CONSTRAINT fk_car_owner FOREIGN KEY (owner_id) REFERENCES public.users(id);


--
-- Name: detections fk_detection_log; Type: FK CONSTRAINT; Schema: public; Owner: ssafy
--

ALTER TABLE ONLY public.detections
    ADD CONSTRAINT fk_detection_log FOREIGN KEY (log_id) REFERENCES public.car_logs(id) ON DELETE CASCADE;


--
-- Name: car_logs fk_log_car; Type: FK CONSTRAINT; Schema: public; Owner: ssafy
--

ALTER TABLE ONLY public.car_logs
    ADD CONSTRAINT fk_log_car FOREIGN KEY (car_id) REFERENCES public.cars(id) ON DELETE CASCADE;


--
-- Name: car_logs fk_log_map; Type: FK CONSTRAINT; Schema: public; Owner: ssafy
--

ALTER TABLE ONLY public.car_logs
    ADD CONSTRAINT fk_log_map FOREIGN KEY (map_id) REFERENCES public.maps(id) ON DELETE CASCADE;


--
-- Name: maps fk_map_car; Type: FK CONSTRAINT; Schema: public; Owner: ssafy
--

ALTER TABLE ONLY public.maps
    ADD CONSTRAINT fk_map_car FOREIGN KEY (car_id) REFERENCES public.cars(id) ON DELETE CASCADE;


--
-- Name: notification_tokens fk_notification_token_member; Type: FK CONSTRAINT; Schema: public; Owner: ssafy
--

ALTER TABLE ONLY public.notification_tokens
    ADD CONSTRAINT fk_notification_token_member FOREIGN KEY (member_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: car_status fk_status_car; Type: FK CONSTRAINT; Schema: public; Owner: ssafy
--

ALTER TABLE ONLY public.car_status
    ADD CONSTRAINT fk_status_car FOREIGN KEY (car_id) REFERENCES public.cars(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict Rm8WZnc4XOARkUCJrT43Zx5GSlInEecHquxhKQaKTwsAdU25nrqPoNMtLjb7IKS

