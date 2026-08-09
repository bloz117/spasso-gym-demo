--
-- PostgreSQL database dump
--


-- Dumped from database version 17.9
-- Dumped by pg_dump version 17.9

-- Started on 2026-07-31 13:40:11

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 217 (class 1259 OID 16665)
-- Name: asistencias_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.asistencias_log (
    id_log integer NOT NULL,
    id_socio integer,
    fecha_entrada timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    id_hardware integer,
    id_locker integer,
    fecha_salida timestamp with time zone
);


ALTER TABLE public.asistencias_log OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 16669)
-- Name: asistencias_log_id_log_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.asistencias_log_id_log_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.asistencias_log_id_log_seq OWNER TO postgres;

--
-- TOC entry 5239 (class 0 OID 0)
-- Dependencies: 218
-- Name: asistencias_log_id_log_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.asistencias_log_id_log_seq OWNED BY public.asistencias_log.id_log;


--
-- TOC entry 219 (class 1259 OID 16670)
-- Name: beneficios_maestros; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.beneficios_maestros (
    id_beneficio integer NOT NULL,
    descripcion character varying(255) NOT NULL
);


ALTER TABLE public.beneficios_maestros OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 16673)
-- Name: beneficios_maestros_id_beneficio_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.beneficios_maestros_id_beneficio_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.beneficios_maestros_id_beneficio_seq OWNER TO postgres;

--
-- TOC entry 5240 (class 0 OID 0)
-- Dependencies: 220
-- Name: beneficios_maestros_id_beneficio_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.beneficios_maestros_id_beneficio_seq OWNED BY public.beneficios_maestros.id_beneficio;


--
-- TOC entry 221 (class 1259 OID 16674)
-- Name: biometria_huellas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.biometria_huellas (
    id_huella integer NOT NULL,
    id_socio integer,
    template_hash bytea NOT NULL,
    dedo_nombre character varying(50)
);


ALTER TABLE public.biometria_huellas OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 16679)
-- Name: biometria_huellas_id_huella_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.biometria_huellas_id_huella_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.biometria_huellas_id_huella_seq OWNER TO postgres;

--
-- TOC entry 5241 (class 0 OID 0)
-- Dependencies: 222
-- Name: biometria_huellas_id_huella_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.biometria_huellas_id_huella_seq OWNED BY public.biometria_huellas.id_huella;


--
-- TOC entry 262 (class 1259 OID 17493)
-- Name: cms_theme; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cms_theme (
    id integer NOT NULL,
    color_palette character varying(50) NOT NULL,
    animation_preset character varying(50) NOT NULL,
    button_shape character varying(50) NOT NULL,
    typography character varying(50) NOT NULL,
    layout_preset character varying(50) NOT NULL,
    custom_css text,
    is_active boolean DEFAULT false,
    created_by integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT cms_theme_animation_preset_check CHECK (((animation_preset)::text = ANY ((ARRAY['pulse'::character varying, 'slide_fade'::character varying, 'zoom_in'::character varying, 'bounce_light'::character varying, 'none'::character varying])::text[]))),
    CONSTRAINT cms_theme_button_shape_check CHECK (((button_shape)::text = ANY ((ARRAY['rounded_full'::character varying, 'rounded_md'::character varying, 'square'::character varying, 'pill_outline'::character varying, 'neon_border'::character varying])::text[]))),
    CONSTRAINT cms_theme_color_palette_check CHECK (((color_palette)::text = ANY ((ARRAY['midnight_fire'::character varying, 'ocean_sport'::character varying, 'forest_strength'::character varying, 'sunset_energy'::character varying, 'monochrome_elite'::character varying])::text[]))),
    CONSTRAINT cms_theme_layout_preset_check CHECK (((layout_preset)::text = ANY ((ARRAY['hero_centered'::character varying, 'sidebar_left'::character varying, 'grid_cards'::character varying, 'full_width_banner'::character varying, 'minimal_list'::character varying])::text[]))),
    CONSTRAINT cms_theme_typography_check CHECK (((typography)::text = ANY ((ARRAY['roboto_modern'::character varying, 'montserrat_bold'::character varying, 'inter_clean'::character varying, 'oswald_sport'::character varying, 'playfair_premium'::character varying])::text[]))),
    CONSTRAINT theme_name_unique CHECK ((((is_active = true) AND (id IS NOT NULL)) OR (is_active = false)))
);


ALTER TABLE public.cms_theme OWNER TO postgres;

--
-- TOC entry 5242 (class 0 OID 0)
-- Dependencies: 262
-- Name: TABLE cms_theme; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.cms_theme IS 'Temas visuales del portal público. Solo uno puede estar activo.';


--
-- TOC entry 5243 (class 0 OID 0)
-- Dependencies: 262
-- Name: COLUMN cms_theme.color_palette; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.cms_theme.color_palette IS 'Esquema de colores: midnight_fire, ocean_sport, etc.';


--
-- TOC entry 5244 (class 0 OID 0)
-- Dependencies: 262
-- Name: COLUMN cms_theme.animation_preset; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.cms_theme.animation_preset IS 'Tipo de animaciones: pulse, slide_fade, zoom_in, etc.';


--
-- TOC entry 5245 (class 0 OID 0)
-- Dependencies: 262
-- Name: COLUMN cms_theme.button_shape; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.cms_theme.button_shape IS 'Forma de botones: rounded_full, square, neon_border, etc.';


--
-- TOC entry 5246 (class 0 OID 0)
-- Dependencies: 262
-- Name: COLUMN cms_theme.typography; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.cms_theme.typography IS 'Familia tipográfica: Roboto, Montserrat, Inter, etc.';


--
-- TOC entry 5247 (class 0 OID 0)
-- Dependencies: 262
-- Name: COLUMN cms_theme.layout_preset; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.cms_theme.layout_preset IS 'Layout: hero_centered, sidebar_left, grid_cards, etc.';


--
-- TOC entry 261 (class 1259 OID 17492)
-- Name: cms_theme_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cms_theme_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cms_theme_id_seq OWNER TO postgres;

--
-- TOC entry 5248 (class 0 OID 0)
-- Dependencies: 261
-- Name: cms_theme_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cms_theme_id_seq OWNED BY public.cms_theme.id;


--
-- TOC entry 223 (class 1259 OID 16680)
-- Name: config_global; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.config_global (
    id_config integer NOT NULL,
    clave character varying(100) NOT NULL,
    valor character varying(255) NOT NULL,
    categoria character varying(50)
);


ALTER TABLE public.config_global OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 16683)
-- Name: config_global_id_config_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.config_global_id_config_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.config_global_id_config_seq OWNER TO postgres;

--
-- TOC entry 5249 (class 0 OID 0)
-- Dependencies: 224
-- Name: config_global_id_config_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.config_global_id_config_seq OWNED BY public.config_global.id_config;


--
-- TOC entry 225 (class 1259 OID 16684)
-- Name: config_portal_publico; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.config_portal_publico (
    id_ui integer NOT NULL,
    seccion_nombre character varying(100) NOT NULL,
    color_primario character varying(7),
    color_secundario character varying(7),
    animacion_tipo character varying(50),
    logo_url text,
    video_fondo_url text
);


ALTER TABLE public.config_portal_publico OWNER TO postgres;

--
-- TOC entry 226 (class 1259 OID 16689)
-- Name: config_portal_publico_id_ui_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.config_portal_publico_id_ui_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.config_portal_publico_id_ui_seq OWNER TO postgres;

--
-- TOC entry 5250 (class 0 OID 0)
-- Dependencies: 226
-- Name: config_portal_publico_id_ui_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.config_portal_publico_id_ui_seq OWNED BY public.config_portal_publico.id_ui;


--
-- TOC entry 227 (class 1259 OID 16690)
-- Name: cuentas_portal_web; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cuentas_portal_web (
    id_cuenta integer NOT NULL,
    id_socio integer,
    usuario_web character varying(50),
    password_web text,
    estado_cuenta character varying(20) DEFAULT 'Activo'::character varying
);


ALTER TABLE public.cuentas_portal_web OWNER TO postgres;

--
-- TOC entry 228 (class 1259 OID 16696)
-- Name: cuentas_portal_web_id_cuenta_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.cuentas_portal_web_id_cuenta_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.cuentas_portal_web_id_cuenta_seq OWNER TO postgres;

--
-- TOC entry 5251 (class 0 OID 0)
-- Dependencies: 228
-- Name: cuentas_portal_web_id_cuenta_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.cuentas_portal_web_id_cuenta_seq OWNED BY public.cuentas_portal_web.id_cuenta;


--
-- TOC entry 229 (class 1259 OID 16697)
-- Name: gestion_lockers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gestion_lockers (
    id_locker integer NOT NULL,
    numero_locker integer NOT NULL,
    zona character varying(50),
    estado character varying(20) DEFAULT 'Libre'::character varying,
    id_socio_actual integer
);


ALTER TABLE public.gestion_lockers OWNER TO postgres;

--
-- TOC entry 230 (class 1259 OID 16701)
-- Name: gestion_lockers_id_locker_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.gestion_lockers_id_locker_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.gestion_lockers_id_locker_seq OWNER TO postgres;

--
-- TOC entry 5252 (class 0 OID 0)
-- Dependencies: 230
-- Name: gestion_lockers_id_locker_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.gestion_lockers_id_locker_seq OWNED BY public.gestion_lockers.id_locker;


--
-- TOC entry 231 (class 1259 OID 16702)
-- Name: guia_alimentacion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.guia_alimentacion (
    id_guia integer NOT NULL,
    id_socio integer,
    objetivo character varying(50),
    recomendaciones_json jsonb
);


ALTER TABLE public.guia_alimentacion OWNER TO postgres;

--
-- TOC entry 232 (class 1259 OID 16707)
-- Name: guia_alimentacion_id_guia_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.guia_alimentacion_id_guia_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.guia_alimentacion_id_guia_seq OWNER TO postgres;

--
-- TOC entry 5253 (class 0 OID 0)
-- Dependencies: 232
-- Name: guia_alimentacion_id_guia_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.guia_alimentacion_id_guia_seq OWNED BY public.guia_alimentacion.id_guia;


--
-- TOC entry 260 (class 1259 OID 17474)
-- Name: gym_config; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gym_config (
    id_config integer NOT NULL,
    lockers_habilitados boolean DEFAULT false,
    cantidad_lockers integer DEFAULT 0,
    nombre_gimnasio character varying(200) DEFAULT 'Spasso Sauna & Gym'::character varying,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by integer,
    horario_apertura time without time zone,
    horario_cierre time without time zone,
    precios_planes jsonb DEFAULT '{}'::jsonb NOT NULL,
    asignacion_lockers_automatica boolean DEFAULT false NOT NULL,
    pantalla_bienvenida_habilitada boolean DEFAULT false NOT NULL,
    duracion_pantalla_bienvenida integer DEFAULT 4 NOT NULL,
    pantalla_bienvenida_logo_url text,
    pantalla_bienvenida_tema character varying(20) DEFAULT 'azul'::character varying NOT NULL,
    CONSTRAINT gym_config_locker_count_check CHECK ((cantidad_lockers >= 0)),
    CONSTRAINT only_one_config CHECK ((id_config = 1))
);


ALTER TABLE public.gym_config OWNER TO postgres;

--
-- TOC entry 5254 (class 0 OID 0)
-- Dependencies: 260
-- Name: TABLE gym_config; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.gym_config IS 'Configuración global del gimnasio. Solo una fila.';


--
-- TOC entry 5255 (class 0 OID 0)
-- Dependencies: 260
-- Name: COLUMN gym_config.cantidad_lockers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.gym_config.cantidad_lockers IS 'Número total de casilleros disponibles';


--
-- TOC entry 5256 (class 0 OID 0)
-- Dependencies: 260
-- Name: COLUMN gym_config.updated_by; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.gym_config.updated_by IS 'Usuario que última vez modificó esta configuración';


--
-- TOC entry 259 (class 1259 OID 17473)
-- Name: gym_config_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.gym_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.gym_config_id_seq OWNER TO postgres;

--
-- TOC entry 5257 (class 0 OID 0)
-- Dependencies: 259
-- Name: gym_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.gym_config_id_seq OWNED BY public.gym_config.id_config;


--
-- TOC entry 233 (class 1259 OID 16708)
-- Name: hardware_perfiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hardware_perfiles (
    id_hardware integer NOT NULL,
    tipo_dispositivo character varying(50) NOT NULL,
    modelo_nombre character varying(100) NOT NULL,
    driver_info text,
    activo boolean DEFAULT true
);


ALTER TABLE public.hardware_perfiles OWNER TO postgres;

--
-- TOC entry 234 (class 1259 OID 16714)
-- Name: hardware_perfiles_id_hardware_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.hardware_perfiles_id_hardware_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.hardware_perfiles_id_hardware_seq OWNER TO postgres;

--
-- TOC entry 5258 (class 0 OID 0)
-- Dependencies: 234
-- Name: hardware_perfiles_id_hardware_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.hardware_perfiles_id_hardware_seq OWNED BY public.hardware_perfiles.id_hardware;


--
-- TOC entry 272 (class 1259 OID 17600)
-- Name: huellas_biometricas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.huellas_biometricas (
    id_huella integer NOT NULL,
    id_socio integer NOT NULL,
    imagen_png bytea NOT NULL,
    num_keypoints integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.huellas_biometricas OWNER TO postgres;

--
-- TOC entry 271 (class 1259 OID 17599)
-- Name: huellas_biometricas_id_huella_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.huellas_biometricas_id_huella_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.huellas_biometricas_id_huella_seq OWNER TO postgres;

--
-- TOC entry 5259 (class 0 OID 0)
-- Dependencies: 271
-- Name: huellas_biometricas_id_huella_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.huellas_biometricas_id_huella_seq OWNED BY public.huellas_biometricas.id_huella;


--
-- TOC entry 235 (class 1259 OID 16715)
-- Name: inventario_productos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventario_productos (
    id_producto integer NOT NULL,
    nombre_producto character varying(100) NOT NULL,
    precio_venta numeric(10,2) NOT NULL,
    stock_actual integer DEFAULT 0
);


ALTER TABLE public.inventario_productos OWNER TO postgres;

--
-- TOC entry 236 (class 1259 OID 16719)
-- Name: inventario_productos_id_producto_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.inventario_productos_id_producto_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.inventario_productos_id_producto_seq OWNER TO postgres;

--
-- TOC entry 5260 (class 0 OID 0)
-- Dependencies: 236
-- Name: inventario_productos_id_producto_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.inventario_productos_id_producto_seq OWNED BY public.inventario_productos.id_producto;


--
-- TOC entry 237 (class 1259 OID 16720)
-- Name: logs_personalizacion; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.logs_personalizacion (
    id_log_edit integer NOT NULL,
    id_usuario integer,
    cambio_realizado text,
    fecha_cambio timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.logs_personalizacion OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 16726)
-- Name: logs_personalizacion_id_log_edit_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.logs_personalizacion_id_log_edit_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.logs_personalizacion_id_log_edit_seq OWNER TO postgres;

--
-- TOC entry 5261 (class 0 OID 0)
-- Dependencies: 238
-- Name: logs_personalizacion_id_log_edit_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.logs_personalizacion_id_log_edit_seq OWNED BY public.logs_personalizacion.id_log_edit;


--
-- TOC entry 266 (class 1259 OID 17535)
-- Name: membresias; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.membresias (
    id_membresia integer NOT NULL,
    id_socio integer NOT NULL,
    tipo_membresia character varying(50),
    plan character varying(100),
    fecha_inicio timestamp with time zone DEFAULT now() NOT NULL,
    fecha_vencimiento timestamp with time zone NOT NULL,
    estado character varying(20) DEFAULT 'activo'::character varying NOT NULL,
    monto numeric(10,2) DEFAULT 0,
    metodo_pago character varying(20) DEFAULT 'efectivo'::character varying,
    creado_en timestamp with time zone DEFAULT now(),
    CONSTRAINT membresias_estado_check CHECK (((estado)::text = ANY ((ARRAY['activo'::character varying, 'por-vencer'::character varying, 'vencido'::character varying, 'renovado'::character varying, 'retirado'::character varying])::text[])))
);


ALTER TABLE public.membresias OWNER TO postgres;

--
-- TOC entry 5262 (class 0 OID 0)
-- Dependencies: 266
-- Name: TABLE membresias; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.membresias IS 'Historial de membresías/planes de cada socio (una fila por período pagado)';


--
-- TOC entry 265 (class 1259 OID 17534)
-- Name: membresias_id_membresia_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.membresias_id_membresia_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.membresias_id_membresia_seq OWNER TO postgres;

--
-- TOC entry 5263 (class 0 OID 0)
-- Dependencies: 265
-- Name: membresias_id_membresia_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.membresias_id_membresia_seq OWNED BY public.membresias.id_membresia;


--
-- TOC entry 239 (class 1259 OID 16727)
-- Name: metodos_pago; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.metodos_pago (
    id_metodo integer NOT NULL,
    nombre_metodo character varying(50) NOT NULL
);


ALTER TABLE public.metodos_pago OWNER TO postgres;

--
-- TOC entry 240 (class 1259 OID 16730)
-- Name: metodos_pago_id_metodo_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.metodos_pago_id_metodo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.metodos_pago_id_metodo_seq OWNER TO postgres;

--
-- TOC entry 5264 (class 0 OID 0)
-- Dependencies: 240
-- Name: metodos_pago_id_metodo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.metodos_pago_id_metodo_seq OWNED BY public.metodos_pago.id_metodo;


--
-- TOC entry 241 (class 1259 OID 16731)
-- Name: plan_beneficios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.plan_beneficios (
    id_plan integer NOT NULL,
    id_beneficio integer NOT NULL
);


ALTER TABLE public.plan_beneficios OWNER TO postgres;

--
-- TOC entry 242 (class 1259 OID 16734)
-- Name: planes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.planes (
    id_plan integer NOT NULL,
    nombre_plan character varying(100) NOT NULL,
    precio_base numeric(10,2),
    duracion_dias integer NOT NULL,
    CONSTRAINT planes_precio_base_check CHECK ((precio_base > (0)::numeric))
);


ALTER TABLE public.planes OWNER TO postgres;

--
-- TOC entry 243 (class 1259 OID 16738)
-- Name: planes_id_plan_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.planes_id_plan_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.planes_id_plan_seq OWNER TO postgres;

--
-- TOC entry 5265 (class 0 OID 0)
-- Dependencies: 243
-- Name: planes_id_plan_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.planes_id_plan_seq OWNED BY public.planes.id_plan;


--
-- TOC entry 258 (class 1259 OID 17449)
-- Name: portal_accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.portal_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    id_socio integer NOT NULL,
    username character varying(100),
    password_hash character varying(255) NOT NULL,
    temp_password character varying(100),
    must_change_password boolean DEFAULT true,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    last_login timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT portal_password_not_empty CHECK ((length(TRIM(BOTH FROM password_hash)) > 0)),
    CONSTRAINT portal_username_not_empty CHECK ((length(TRIM(BOTH FROM username)) > 0))
);


ALTER TABLE public.portal_accounts OWNER TO postgres;

--
-- TOC entry 5266 (class 0 OID 0)
-- Dependencies: 258
-- Name: TABLE portal_accounts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.portal_accounts IS 'Autenticación de socios en el portal público';


--
-- TOC entry 5267 (class 0 OID 0)
-- Dependencies: 258
-- Name: COLUMN portal_accounts.temp_password; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.portal_accounts.temp_password IS 'Se asigna al crear, se borra tras primer cambio';


--
-- TOC entry 5268 (class 0 OID 0)
-- Dependencies: 258
-- Name: COLUMN portal_accounts.must_change_password; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.portal_accounts.must_change_password IS 'Fuerza cambio de password en primer login';


--
-- TOC entry 268 (class 1259 OID 17556)
-- Name: productos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.productos (
    id_producto integer NOT NULL,
    codigo character varying(50),
    nombre character varying(150) NOT NULL,
    categoria character varying(50) DEFAULT 'otros'::character varying NOT NULL,
    precio_compra numeric(10,2) DEFAULT 0 NOT NULL,
    precio_venta numeric(10,2) DEFAULT 0 NOT NULL,
    cantidad integer DEFAULT 0 NOT NULL,
    stock_minimo integer DEFAULT 5 NOT NULL,
    stock_maximo integer DEFAULT 100 NOT NULL,
    imagen_url text,
    activo boolean DEFAULT true NOT NULL,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    actualizado_en timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.productos OWNER TO postgres;

--
-- TOC entry 267 (class 1259 OID 17555)
-- Name: productos_id_producto_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.productos_id_producto_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.productos_id_producto_seq OWNER TO postgres;

--
-- TOC entry 5269 (class 0 OID 0)
-- Dependencies: 267
-- Name: productos_id_producto_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.productos_id_producto_seq OWNED BY public.productos.id_producto;


--
-- TOC entry 270 (class 1259 OID 17578)
-- Name: productos_movimientos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.productos_movimientos (
    id_movimiento integer NOT NULL,
    id_producto integer NOT NULL,
    tipo character varying(20) NOT NULL,
    cantidad integer NOT NULL,
    motivo character varying(255),
    id_usuario integer,
    creado_en timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT productos_movimientos_tipo_check CHECK (((tipo)::text = ANY ((ARRAY['entrada'::character varying, 'salida'::character varying, 'ajuste'::character varying])::text[])))
);


ALTER TABLE public.productos_movimientos OWNER TO postgres;

--
-- TOC entry 269 (class 1259 OID 17577)
-- Name: productos_movimientos_id_movimiento_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.productos_movimientos_id_movimiento_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.productos_movimientos_id_movimiento_seq OWNER TO postgres;

--
-- TOC entry 5270 (class 0 OID 0)
-- Dependencies: 269
-- Name: productos_movimientos_id_movimiento_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.productos_movimientos_id_movimiento_seq OWNED BY public.productos_movimientos.id_movimiento;


--
-- TOC entry 244 (class 1259 OID 16739)
-- Name: promociones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.promociones (
    id_promo integer NOT NULL,
    nombre_promo character varying(100),
    descuento_porcentaje integer,
    fecha_inicio date,
    fecha_fin date,
    CONSTRAINT promociones_descuento_porcentaje_check CHECK (((descuento_porcentaje >= 0) AND (descuento_porcentaje <= 100)))
);


ALTER TABLE public.promociones OWNER TO postgres;

--
-- TOC entry 245 (class 1259 OID 16743)
-- Name: promociones_id_promo_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.promociones_id_promo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.promociones_id_promo_seq OWNER TO postgres;

--
-- TOC entry 5271 (class 0 OID 0)
-- Dependencies: 245
-- Name: promociones_id_promo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.promociones_id_promo_seq OWNED BY public.promociones.id_promo;


--
-- TOC entry 246 (class 1259 OID 16744)
-- Name: roles_permisos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles_permisos (
    id_rol integer NOT NULL,
    nombre_rol character varying(50) NOT NULL
);


ALTER TABLE public.roles_permisos OWNER TO postgres;

--
-- TOC entry 247 (class 1259 OID 16747)
-- Name: roles_permisos_id_rol_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.roles_permisos_id_rol_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.roles_permisos_id_rol_seq OWNER TO postgres;

--
-- TOC entry 5272 (class 0 OID 0)
-- Dependencies: 247
-- Name: roles_permisos_id_rol_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.roles_permisos_id_rol_seq OWNED BY public.roles_permisos.id_rol;


--
-- TOC entry 248 (class 1259 OID 16748)
-- Name: rutinas_recomendadas; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rutinas_recomendadas (
    id_rutina integer NOT NULL,
    id_socio integer,
    nombre_rutina character varying(100),
    instrucciones text,
    video_url text
);


ALTER TABLE public.rutinas_recomendadas OWNER TO postgres;

--
-- TOC entry 249 (class 1259 OID 16753)
-- Name: rutinas_recomendadas_id_rutina_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.rutinas_recomendadas_id_rutina_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.rutinas_recomendadas_id_rutina_seq OWNER TO postgres;

--
-- TOC entry 5273 (class 0 OID 0)
-- Dependencies: 249
-- Name: rutinas_recomendadas_id_rutina_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.rutinas_recomendadas_id_rutina_seq OWNED BY public.rutinas_recomendadas.id_rutina;


--
-- TOC entry 250 (class 1259 OID 16754)
-- Name: socios; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.socios (
    id_socio integer NOT NULL,
    uuid_web uuid DEFAULT gen_random_uuid(),
    nombres character varying(100) NOT NULL,
    apellidos character varying(100) NOT NULL,
    dni character varying(20) NOT NULL,
    email character varying(100),
    fecha_registro timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    foto_url text
);


ALTER TABLE public.socios OWNER TO postgres;

--
-- TOC entry 251 (class 1259 OID 16759)
-- Name: socios_id_socio_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.socios_id_socio_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.socios_id_socio_seq OWNER TO postgres;

--
-- TOC entry 5274 (class 0 OID 0)
-- Dependencies: 251
-- Name: socios_id_socio_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.socios_id_socio_seq OWNED BY public.socios.id_socio;


--
-- TOC entry 252 (class 1259 OID 16760)
-- Name: usuarios_sistema; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.usuarios_sistema (
    id_usuario integer NOT NULL,
    username character varying(50) NOT NULL,
    password_hash text NOT NULL,
    id_rol integer
);


ALTER TABLE public.usuarios_sistema OWNER TO postgres;

--
-- TOC entry 253 (class 1259 OID 16765)
-- Name: usuarios_sistema_id_usuario_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.usuarios_sistema_id_usuario_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.usuarios_sistema_id_usuario_seq OWNER TO postgres;

--
-- TOC entry 5275 (class 0 OID 0)
-- Dependencies: 253
-- Name: usuarios_sistema_id_usuario_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.usuarios_sistema_id_usuario_seq OWNED BY public.usuarios_sistema.id_usuario;


--
-- TOC entry 254 (class 1259 OID 16766)
-- Name: ventas_cabecera; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ventas_cabecera (
    id_venta integer NOT NULL,
    id_socio integer,
    id_usuario integer,
    total numeric(10,2) NOT NULL,
    fecha_venta timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    origen_venta character varying(20)
);


ALTER TABLE public.ventas_cabecera OWNER TO postgres;

--
-- TOC entry 255 (class 1259 OID 16770)
-- Name: ventas_cabecera_id_venta_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ventas_cabecera_id_venta_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ventas_cabecera_id_venta_seq OWNER TO postgres;

--
-- TOC entry 5276 (class 0 OID 0)
-- Dependencies: 255
-- Name: ventas_cabecera_id_venta_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ventas_cabecera_id_venta_seq OWNED BY public.ventas_cabecera.id_venta;


--
-- TOC entry 256 (class 1259 OID 16771)
-- Name: ventas_detalle; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ventas_detalle (
    id_detalle integer NOT NULL,
    id_venta integer,
    id_item integer NOT NULL,
    tipo_item character varying(20),
    cantidad integer DEFAULT 1,
    subtotal numeric(10,2)
);


ALTER TABLE public.ventas_detalle OWNER TO postgres;

--
-- TOC entry 257 (class 1259 OID 16775)
-- Name: ventas_detalle_id_detalle_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ventas_detalle_id_detalle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ventas_detalle_id_detalle_seq OWNER TO postgres;

--
-- TOC entry 5277 (class 0 OID 0)
-- Dependencies: 257
-- Name: ventas_detalle_id_detalle_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ventas_detalle_id_detalle_seq OWNED BY public.ventas_detalle.id_detalle;


--
-- TOC entry 264 (class 1259 OID 17518)
-- Name: workout_routines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.workout_routines (
    id integer NOT NULL,
    level character varying(20) NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    duration_minutes integer DEFAULT 45,
    exercises jsonb NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT routine_exercises_not_empty CHECK ((jsonb_array_length(exercises) > 0)),
    CONSTRAINT workout_routines_level_check CHECK (((level)::text = ANY ((ARRAY['basico'::character varying, 'medio'::character varying, 'avanzado'::character varying])::text[])))
);


ALTER TABLE public.workout_routines OWNER TO postgres;

--
-- TOC entry 5278 (class 0 OID 0)
-- Dependencies: 264
-- Name: TABLE workout_routines; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.workout_routines IS 'Rutinas de entrenamiento recomendadas por nivel (básico, medio, avanzado)';


--
-- TOC entry 5279 (class 0 OID 0)
-- Dependencies: 264
-- Name: COLUMN workout_routines.exercises; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.workout_routines.exercises IS 'Array JSONB de ejercicios con detalles (sets, reps, descanso, etc.)';


--
-- TOC entry 263 (class 1259 OID 17517)
-- Name: workout_routines_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.workout_routines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.workout_routines_id_seq OWNER TO postgres;

--
-- TOC entry 5280 (class 0 OID 0)
-- Dependencies: 263
-- Name: workout_routines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.workout_routines_id_seq OWNED BY public.workout_routines.id;


--
-- TOC entry 4880 (class 2604 OID 16776)
-- Name: asistencias_log id_log; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencias_log ALTER COLUMN id_log SET DEFAULT nextval('public.asistencias_log_id_log_seq'::regclass);


--
-- TOC entry 4882 (class 2604 OID 16777)
-- Name: beneficios_maestros id_beneficio; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.beneficios_maestros ALTER COLUMN id_beneficio SET DEFAULT nextval('public.beneficios_maestros_id_beneficio_seq'::regclass);


--
-- TOC entry 4883 (class 2604 OID 16778)
-- Name: biometria_huellas id_huella; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.biometria_huellas ALTER COLUMN id_huella SET DEFAULT nextval('public.biometria_huellas_id_huella_seq'::regclass);


--
-- TOC entry 4925 (class 2604 OID 17496)
-- Name: cms_theme id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cms_theme ALTER COLUMN id SET DEFAULT nextval('public.cms_theme_id_seq'::regclass);


--
-- TOC entry 4884 (class 2604 OID 16779)
-- Name: config_global id_config; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.config_global ALTER COLUMN id_config SET DEFAULT nextval('public.config_global_id_config_seq'::regclass);


--
-- TOC entry 4885 (class 2604 OID 16780)
-- Name: config_portal_publico id_ui; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.config_portal_publico ALTER COLUMN id_ui SET DEFAULT nextval('public.config_portal_publico_id_ui_seq'::regclass);


--
-- TOC entry 4886 (class 2604 OID 16781)
-- Name: cuentas_portal_web id_cuenta; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cuentas_portal_web ALTER COLUMN id_cuenta SET DEFAULT nextval('public.cuentas_portal_web_id_cuenta_seq'::regclass);


--
-- TOC entry 4888 (class 2604 OID 16782)
-- Name: gestion_lockers id_locker; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gestion_lockers ALTER COLUMN id_locker SET DEFAULT nextval('public.gestion_lockers_id_locker_seq'::regclass);


--
-- TOC entry 4890 (class 2604 OID 16783)
-- Name: guia_alimentacion id_guia; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.guia_alimentacion ALTER COLUMN id_guia SET DEFAULT nextval('public.guia_alimentacion_id_guia_seq'::regclass);


--
-- TOC entry 4915 (class 2604 OID 17477)
-- Name: gym_config id_config; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gym_config ALTER COLUMN id_config SET DEFAULT nextval('public.gym_config_id_seq'::regclass);


--
-- TOC entry 4891 (class 2604 OID 16784)
-- Name: hardware_perfiles id_hardware; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hardware_perfiles ALTER COLUMN id_hardware SET DEFAULT nextval('public.hardware_perfiles_id_hardware_seq'::regclass);


--
-- TOC entry 4952 (class 2604 OID 17603)
-- Name: huellas_biometricas id_huella; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.huellas_biometricas ALTER COLUMN id_huella SET DEFAULT nextval('public.huellas_biometricas_id_huella_seq'::regclass);


--
-- TOC entry 4893 (class 2604 OID 16785)
-- Name: inventario_productos id_producto; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventario_productos ALTER COLUMN id_producto SET DEFAULT nextval('public.inventario_productos_id_producto_seq'::regclass);


--
-- TOC entry 4895 (class 2604 OID 16786)
-- Name: logs_personalizacion id_log_edit; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.logs_personalizacion ALTER COLUMN id_log_edit SET DEFAULT nextval('public.logs_personalizacion_id_log_edit_seq'::regclass);


--
-- TOC entry 4934 (class 2604 OID 17538)
-- Name: membresias id_membresia; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membresias ALTER COLUMN id_membresia SET DEFAULT nextval('public.membresias_id_membresia_seq'::regclass);


--
-- TOC entry 4897 (class 2604 OID 16787)
-- Name: metodos_pago id_metodo; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.metodos_pago ALTER COLUMN id_metodo SET DEFAULT nextval('public.metodos_pago_id_metodo_seq'::regclass);


--
-- TOC entry 4898 (class 2604 OID 16788)
-- Name: planes id_plan; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.planes ALTER COLUMN id_plan SET DEFAULT nextval('public.planes_id_plan_seq'::regclass);


--
-- TOC entry 4940 (class 2604 OID 17559)
-- Name: productos id_producto; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.productos ALTER COLUMN id_producto SET DEFAULT nextval('public.productos_id_producto_seq'::regclass);


--
-- TOC entry 4950 (class 2604 OID 17581)
-- Name: productos_movimientos id_movimiento; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.productos_movimientos ALTER COLUMN id_movimiento SET DEFAULT nextval('public.productos_movimientos_id_movimiento_seq'::regclass);


--
-- TOC entry 4899 (class 2604 OID 16789)
-- Name: promociones id_promo; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promociones ALTER COLUMN id_promo SET DEFAULT nextval('public.promociones_id_promo_seq'::regclass);


--
-- TOC entry 4900 (class 2604 OID 16790)
-- Name: roles_permisos id_rol; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles_permisos ALTER COLUMN id_rol SET DEFAULT nextval('public.roles_permisos_id_rol_seq'::regclass);


--
-- TOC entry 4901 (class 2604 OID 16791)
-- Name: rutinas_recomendadas id_rutina; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rutinas_recomendadas ALTER COLUMN id_rutina SET DEFAULT nextval('public.rutinas_recomendadas_id_rutina_seq'::regclass);


--
-- TOC entry 4902 (class 2604 OID 16792)
-- Name: socios id_socio; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.socios ALTER COLUMN id_socio SET DEFAULT nextval('public.socios_id_socio_seq'::regclass);


--
-- TOC entry 4905 (class 2604 OID 16793)
-- Name: usuarios_sistema id_usuario; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios_sistema ALTER COLUMN id_usuario SET DEFAULT nextval('public.usuarios_sistema_id_usuario_seq'::regclass);


--
-- TOC entry 4906 (class 2604 OID 16794)
-- Name: ventas_cabecera id_venta; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ventas_cabecera ALTER COLUMN id_venta SET DEFAULT nextval('public.ventas_cabecera_id_venta_seq'::regclass);


--
-- TOC entry 4908 (class 2604 OID 16795)
-- Name: ventas_detalle id_detalle; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ventas_detalle ALTER COLUMN id_detalle SET DEFAULT nextval('public.ventas_detalle_id_detalle_seq'::regclass);


--
-- TOC entry 4929 (class 2604 OID 17521)
-- Name: workout_routines id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workout_routines ALTER COLUMN id SET DEFAULT nextval('public.workout_routines_id_seq'::regclass);


--
-- TOC entry 4972 (class 2606 OID 16797)
-- Name: asistencias_log asistencias_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencias_log
    ADD CONSTRAINT asistencias_log_pkey PRIMARY KEY (id_log);


--
-- TOC entry 4974 (class 2606 OID 16799)
-- Name: beneficios_maestros beneficios_maestros_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.beneficios_maestros
    ADD CONSTRAINT beneficios_maestros_pkey PRIMARY KEY (id_beneficio);


--
-- TOC entry 4976 (class 2606 OID 16801)
-- Name: biometria_huellas biometria_huellas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.biometria_huellas
    ADD CONSTRAINT biometria_huellas_pkey PRIMARY KEY (id_huella);


--
-- TOC entry 5042 (class 2606 OID 17509)
-- Name: cms_theme cms_theme_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cms_theme
    ADD CONSTRAINT cms_theme_pkey PRIMARY KEY (id);


--
-- TOC entry 4978 (class 2606 OID 16803)
-- Name: config_global config_global_clave_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.config_global
    ADD CONSTRAINT config_global_clave_key UNIQUE (clave);


--
-- TOC entry 4980 (class 2606 OID 16805)
-- Name: config_global config_global_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.config_global
    ADD CONSTRAINT config_global_pkey PRIMARY KEY (id_config);


--
-- TOC entry 4982 (class 2606 OID 16807)
-- Name: config_portal_publico config_portal_publico_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.config_portal_publico
    ADD CONSTRAINT config_portal_publico_pkey PRIMARY KEY (id_ui);


--
-- TOC entry 4984 (class 2606 OID 16809)
-- Name: cuentas_portal_web cuentas_portal_web_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cuentas_portal_web
    ADD CONSTRAINT cuentas_portal_web_pkey PRIMARY KEY (id_cuenta);


--
-- TOC entry 4986 (class 2606 OID 16811)
-- Name: cuentas_portal_web cuentas_portal_web_usuario_web_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cuentas_portal_web
    ADD CONSTRAINT cuentas_portal_web_usuario_web_key UNIQUE (usuario_web);


--
-- TOC entry 4988 (class 2606 OID 16813)
-- Name: gestion_lockers gestion_lockers_numero_locker_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gestion_lockers
    ADD CONSTRAINT gestion_lockers_numero_locker_key UNIQUE (numero_locker);


--
-- TOC entry 4990 (class 2606 OID 16815)
-- Name: gestion_lockers gestion_lockers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gestion_lockers
    ADD CONSTRAINT gestion_lockers_pkey PRIMARY KEY (id_locker);


--
-- TOC entry 4992 (class 2606 OID 16817)
-- Name: guia_alimentacion guia_alimentacion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.guia_alimentacion
    ADD CONSTRAINT guia_alimentacion_pkey PRIMARY KEY (id_guia);


--
-- TOC entry 5039 (class 2606 OID 17485)
-- Name: gym_config gym_config_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gym_config
    ADD CONSTRAINT gym_config_pkey PRIMARY KEY (id_config);


--
-- TOC entry 4994 (class 2606 OID 16819)
-- Name: hardware_perfiles hardware_perfiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hardware_perfiles
    ADD CONSTRAINT hardware_perfiles_pkey PRIMARY KEY (id_hardware);


--
-- TOC entry 5063 (class 2606 OID 17611)
-- Name: huellas_biometricas huellas_biometricas_id_socio_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.huellas_biometricas
    ADD CONSTRAINT huellas_biometricas_id_socio_key UNIQUE (id_socio);


--
-- TOC entry 5065 (class 2606 OID 17609)
-- Name: huellas_biometricas huellas_biometricas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.huellas_biometricas
    ADD CONSTRAINT huellas_biometricas_pkey PRIMARY KEY (id_huella);


--
-- TOC entry 4996 (class 2606 OID 16821)
-- Name: inventario_productos inventario_productos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventario_productos
    ADD CONSTRAINT inventario_productos_pkey PRIMARY KEY (id_producto);


--
-- TOC entry 4998 (class 2606 OID 16823)
-- Name: logs_personalizacion logs_personalizacion_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.logs_personalizacion
    ADD CONSTRAINT logs_personalizacion_pkey PRIMARY KEY (id_log_edit);


--
-- TOC entry 5053 (class 2606 OID 17546)
-- Name: membresias membresias_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membresias
    ADD CONSTRAINT membresias_pkey PRIMARY KEY (id_membresia);


--
-- TOC entry 5000 (class 2606 OID 16825)
-- Name: metodos_pago metodos_pago_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.metodos_pago
    ADD CONSTRAINT metodos_pago_pkey PRIMARY KEY (id_metodo);


--
-- TOC entry 5002 (class 2606 OID 16827)
-- Name: plan_beneficios plan_beneficios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plan_beneficios
    ADD CONSTRAINT plan_beneficios_pkey PRIMARY KEY (id_plan, id_beneficio);


--
-- TOC entry 5004 (class 2606 OID 16829)
-- Name: planes planes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.planes
    ADD CONSTRAINT planes_pkey PRIMARY KEY (id_plan);


--
-- TOC entry 5033 (class 2606 OID 17460)
-- Name: portal_accounts portal_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portal_accounts
    ADD CONSTRAINT portal_accounts_pkey PRIMARY KEY (id);


--
-- TOC entry 5035 (class 2606 OID 17462)
-- Name: portal_accounts portal_accounts_socio_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portal_accounts
    ADD CONSTRAINT portal_accounts_socio_id_key UNIQUE (id_socio);


--
-- TOC entry 5037 (class 2606 OID 17464)
-- Name: portal_accounts portal_accounts_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portal_accounts
    ADD CONSTRAINT portal_accounts_username_key UNIQUE (username);


--
-- TOC entry 5057 (class 2606 OID 17574)
-- Name: productos productos_codigo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_codigo_key UNIQUE (codigo);


--
-- TOC entry 5061 (class 2606 OID 17585)
-- Name: productos_movimientos productos_movimientos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.productos_movimientos
    ADD CONSTRAINT productos_movimientos_pkey PRIMARY KEY (id_movimiento);


--
-- TOC entry 5059 (class 2606 OID 17572)
-- Name: productos productos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.productos
    ADD CONSTRAINT productos_pkey PRIMARY KEY (id_producto);


--
-- TOC entry 5006 (class 2606 OID 16831)
-- Name: promociones promociones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.promociones
    ADD CONSTRAINT promociones_pkey PRIMARY KEY (id_promo);


--
-- TOC entry 5008 (class 2606 OID 16833)
-- Name: roles_permisos roles_permisos_nombre_rol_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles_permisos
    ADD CONSTRAINT roles_permisos_nombre_rol_key UNIQUE (nombre_rol);


--
-- TOC entry 5010 (class 2606 OID 16835)
-- Name: roles_permisos roles_permisos_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles_permisos
    ADD CONSTRAINT roles_permisos_pkey PRIMARY KEY (id_rol);


--
-- TOC entry 5012 (class 2606 OID 16837)
-- Name: rutinas_recomendadas rutinas_recomendadas_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rutinas_recomendadas
    ADD CONSTRAINT rutinas_recomendadas_pkey PRIMARY KEY (id_rutina);


--
-- TOC entry 5014 (class 2606 OID 16839)
-- Name: socios socios_dni_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.socios
    ADD CONSTRAINT socios_dni_key UNIQUE (dni);


--
-- TOC entry 5016 (class 2606 OID 16841)
-- Name: socios socios_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.socios
    ADD CONSTRAINT socios_email_key UNIQUE (email);


--
-- TOC entry 5018 (class 2606 OID 16843)
-- Name: socios socios_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.socios
    ADD CONSTRAINT socios_pkey PRIMARY KEY (id_socio);


--
-- TOC entry 5020 (class 2606 OID 16845)
-- Name: socios socios_uuid_web_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.socios
    ADD CONSTRAINT socios_uuid_web_key UNIQUE (uuid_web);


--
-- TOC entry 5022 (class 2606 OID 16847)
-- Name: usuarios_sistema usuarios_sistema_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios_sistema
    ADD CONSTRAINT usuarios_sistema_pkey PRIMARY KEY (id_usuario);


--
-- TOC entry 5024 (class 2606 OID 16849)
-- Name: usuarios_sistema usuarios_sistema_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios_sistema
    ADD CONSTRAINT usuarios_sistema_username_key UNIQUE (username);


--
-- TOC entry 5026 (class 2606 OID 16851)
-- Name: ventas_cabecera ventas_cabecera_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ventas_cabecera
    ADD CONSTRAINT ventas_cabecera_pkey PRIMARY KEY (id_venta);


--
-- TOC entry 5028 (class 2606 OID 16853)
-- Name: ventas_detalle ventas_detalle_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ventas_detalle
    ADD CONSTRAINT ventas_detalle_pkey PRIMARY KEY (id_detalle);


--
-- TOC entry 5048 (class 2606 OID 17531)
-- Name: workout_routines workout_routines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.workout_routines
    ADD CONSTRAINT workout_routines_pkey PRIMARY KEY (id);


--
-- TOC entry 5043 (class 1259 OID 17515)
-- Name: idx_cms_theme_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cms_theme_active ON public.cms_theme USING btree (is_active) WHERE (is_active = true);


--
-- TOC entry 5044 (class 1259 OID 17516)
-- Name: idx_cms_theme_created_by; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_cms_theme_created_by ON public.cms_theme USING btree (created_by);


--
-- TOC entry 5040 (class 1259 OID 17491)
-- Name: idx_gym_config_single; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_gym_config_single ON public.gym_config USING btree (id_config);


--
-- TOC entry 5066 (class 1259 OID 17617)
-- Name: idx_huellas_id_socio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_huellas_id_socio ON public.huellas_biometricas USING btree (id_socio);


--
-- TOC entry 5049 (class 1259 OID 17553)
-- Name: idx_membresias_estado; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_membresias_estado ON public.membresias USING btree (estado);


--
-- TOC entry 5050 (class 1259 OID 17552)
-- Name: idx_membresias_id_socio; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_membresias_id_socio ON public.membresias USING btree (id_socio);


--
-- TOC entry 5051 (class 1259 OID 17554)
-- Name: idx_membresias_vencimiento; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_membresias_vencimiento ON public.membresias USING btree (fecha_vencimiento);


--
-- TOC entry 5029 (class 1259 OID 17472)
-- Name: idx_portal_accounts_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_accounts_is_active ON public.portal_accounts USING btree (is_active);


--
-- TOC entry 5030 (class 1259 OID 17471)
-- Name: idx_portal_accounts_socio_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_accounts_socio_id ON public.portal_accounts USING btree (id_socio);


--
-- TOC entry 5031 (class 1259 OID 17470)
-- Name: idx_portal_accounts_username; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portal_accounts_username ON public.portal_accounts USING btree (username);


--
-- TOC entry 5054 (class 1259 OID 17576)
-- Name: idx_productos_activo; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_productos_activo ON public.productos USING btree (activo);


--
-- TOC entry 5055 (class 1259 OID 17575)
-- Name: idx_productos_categoria; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_productos_categoria ON public.productos USING btree (categoria);


--
-- TOC entry 5045 (class 1259 OID 17533)
-- Name: idx_workout_routines_is_active; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workout_routines_is_active ON public.workout_routines USING btree (is_active);


--
-- TOC entry 5046 (class 1259 OID 17532)
-- Name: idx_workout_routines_level; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_workout_routines_level ON public.workout_routines USING btree (level);


--
-- TOC entry 5067 (class 2606 OID 16854)
-- Name: asistencias_log asistencias_log_id_hardware_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencias_log
    ADD CONSTRAINT asistencias_log_id_hardware_fkey FOREIGN KEY (id_hardware) REFERENCES public.hardware_perfiles(id_hardware);


--
-- TOC entry 5068 (class 2606 OID 17618)
-- Name: asistencias_log asistencias_log_id_locker_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencias_log
    ADD CONSTRAINT asistencias_log_id_locker_fkey FOREIGN KEY (id_locker) REFERENCES public.gestion_lockers(id_locker);


--
-- TOC entry 5069 (class 2606 OID 16859)
-- Name: asistencias_log asistencias_log_id_socio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.asistencias_log
    ADD CONSTRAINT asistencias_log_id_socio_fkey FOREIGN KEY (id_socio) REFERENCES public.socios(id_socio);


--
-- TOC entry 5070 (class 2606 OID 16864)
-- Name: biometria_huellas biometria_huellas_id_socio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.biometria_huellas
    ADD CONSTRAINT biometria_huellas_id_socio_fkey FOREIGN KEY (id_socio) REFERENCES public.socios(id_socio) ON DELETE CASCADE;


--
-- TOC entry 5084 (class 2606 OID 17510)
-- Name: cms_theme cms_theme_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cms_theme
    ADD CONSTRAINT cms_theme_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.usuarios_sistema(id_usuario);


--
-- TOC entry 5071 (class 2606 OID 16869)
-- Name: cuentas_portal_web cuentas_portal_web_id_socio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cuentas_portal_web
    ADD CONSTRAINT cuentas_portal_web_id_socio_fkey FOREIGN KEY (id_socio) REFERENCES public.socios(id_socio);


--
-- TOC entry 5072 (class 2606 OID 16874)
-- Name: gestion_lockers gestion_lockers_id_socio_actual_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gestion_lockers
    ADD CONSTRAINT gestion_lockers_id_socio_actual_fkey FOREIGN KEY (id_socio_actual) REFERENCES public.socios(id_socio);


--
-- TOC entry 5073 (class 2606 OID 16879)
-- Name: guia_alimentacion guia_alimentacion_id_socio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.guia_alimentacion
    ADD CONSTRAINT guia_alimentacion_id_socio_fkey FOREIGN KEY (id_socio) REFERENCES public.socios(id_socio);


--
-- TOC entry 5083 (class 2606 OID 17486)
-- Name: gym_config gym_config_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gym_config
    ADD CONSTRAINT gym_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.usuarios_sistema(id_usuario);


--
-- TOC entry 5088 (class 2606 OID 17612)
-- Name: huellas_biometricas huellas_biometricas_id_socio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.huellas_biometricas
    ADD CONSTRAINT huellas_biometricas_id_socio_fkey FOREIGN KEY (id_socio) REFERENCES public.socios(id_socio) ON DELETE CASCADE;


--
-- TOC entry 5074 (class 2606 OID 16884)
-- Name: logs_personalizacion logs_personalizacion_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.logs_personalizacion
    ADD CONSTRAINT logs_personalizacion_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios_sistema(id_usuario);


--
-- TOC entry 5085 (class 2606 OID 17547)
-- Name: membresias membresias_id_socio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.membresias
    ADD CONSTRAINT membresias_id_socio_fkey FOREIGN KEY (id_socio) REFERENCES public.socios(id_socio) ON DELETE CASCADE;


--
-- TOC entry 5075 (class 2606 OID 16889)
-- Name: plan_beneficios plan_beneficios_id_beneficio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plan_beneficios
    ADD CONSTRAINT plan_beneficios_id_beneficio_fkey FOREIGN KEY (id_beneficio) REFERENCES public.beneficios_maestros(id_beneficio);


--
-- TOC entry 5076 (class 2606 OID 16894)
-- Name: plan_beneficios plan_beneficios_id_plan_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.plan_beneficios
    ADD CONSTRAINT plan_beneficios_id_plan_fkey FOREIGN KEY (id_plan) REFERENCES public.planes(id_plan);


--
-- TOC entry 5082 (class 2606 OID 17465)
-- Name: portal_accounts portal_accounts_socio_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portal_accounts
    ADD CONSTRAINT portal_accounts_socio_id_fkey FOREIGN KEY (id_socio) REFERENCES public.socios(id_socio) ON DELETE CASCADE;


--
-- TOC entry 5086 (class 2606 OID 17586)
-- Name: productos_movimientos productos_movimientos_id_producto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.productos_movimientos
    ADD CONSTRAINT productos_movimientos_id_producto_fkey FOREIGN KEY (id_producto) REFERENCES public.productos(id_producto) ON DELETE CASCADE;


--
-- TOC entry 5087 (class 2606 OID 17591)
-- Name: productos_movimientos productos_movimientos_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.productos_movimientos
    ADD CONSTRAINT productos_movimientos_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios_sistema(id_usuario);


--
-- TOC entry 5077 (class 2606 OID 16899)
-- Name: rutinas_recomendadas rutinas_recomendadas_id_socio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rutinas_recomendadas
    ADD CONSTRAINT rutinas_recomendadas_id_socio_fkey FOREIGN KEY (id_socio) REFERENCES public.socios(id_socio);


--
-- TOC entry 5078 (class 2606 OID 16904)
-- Name: usuarios_sistema usuarios_sistema_id_rol_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.usuarios_sistema
    ADD CONSTRAINT usuarios_sistema_id_rol_fkey FOREIGN KEY (id_rol) REFERENCES public.roles_permisos(id_rol);


--
-- TOC entry 5079 (class 2606 OID 16909)
-- Name: ventas_cabecera ventas_cabecera_id_socio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ventas_cabecera
    ADD CONSTRAINT ventas_cabecera_id_socio_fkey FOREIGN KEY (id_socio) REFERENCES public.socios(id_socio);


--
-- TOC entry 5080 (class 2606 OID 16914)
-- Name: ventas_cabecera ventas_cabecera_id_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ventas_cabecera
    ADD CONSTRAINT ventas_cabecera_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuarios_sistema(id_usuario);


--
-- TOC entry 5081 (class 2606 OID 16919)
-- Name: ventas_detalle ventas_detalle_id_venta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ventas_detalle
    ADD CONSTRAINT ventas_detalle_id_venta_fkey FOREIGN KEY (id_venta) REFERENCES public.ventas_cabecera(id_venta);


-- Completed on 2026-07-31 13:40:11

--
-- PostgreSQL database dump complete
--


