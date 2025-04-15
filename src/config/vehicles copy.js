import { vehicleService } from '../services/vehicleService';

// 基础车辆配置列表
export const vehiclesList = [
    {
        id: 'lamborghini-huracan-sterrato-2024',
        name: 'Lamborghini Huracán Sterrato 2024',
        model: '/models/lamborghini-glb/2024_lamborghini_huracan_sterrato.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 260,
            acceleration: 3.4,
            handling: 9.0,
            braking: 9.2
        },
        scale: 200,
        position: [0, 0.8, 0],
        rotation: -Math.PI/2,
        colors: {
            body: '#2f426f',
            wheel: '#1a1a1a'
        }
    },
    {
        id: 'lamborghini-countach-lpi-2022',
        name: 'Lamborghini Countach LPI 800-4 2022',
        model: '/models/lamborghini-glb/2022_lamborghini_countach_lpi_800-4.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 355,
            acceleration: 2.8,
            handling: 9.5,
            braking: 9.4
        },
        scale: 200,
        position: [0, 0.8, 0],
        rotation: -Math.PI/2,
        colors: {
            body: '#ffffff',
            wheel: '#1a1a1a'
        }
    },
    {
        id: 'lamborghini-sian-roadster-2021',
        name: 'Lamborghini Sián Roadster 2021',
        model: '/models/lamborghini-glb/2021_lamborghini_sian_roadster.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 350,
            acceleration: 2.9,
            handling: 9.6,
            braking: 9.5
        },
        scale: 200,
        position: [0, 0.8, 0],
        rotation: -Math.PI/2,
        colors: {
            body: '#4caf50',
            wheel: '#1a1a1a'
        }
    },
    {
        id: 'lamborghini-sc20-2020',
        name: 'Lamborghini SC20 2020',
        model: '/models/lamborghini-glb/2020_lamborghini_sc20.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 345,
            acceleration: 2.8,
            handling: 9.7,
            braking: 9.6
        },
        scale: 200,
        position: [0, 0.8, 0]
    },
    {
        id: 'lamborghini-veneno',
        name: 'Lamborghini Veneno',
        model: '/models/lamborghini-glb/lamborghini_venevo.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 355,
            acceleration: 2.8,
            handling: 9.8,
            braking: 9.7
        },
        scale: 0.5,
        position: [0, 0.5, 0]
    },
    {
        id: 'lamborghini-revuelto',
        name: 'Lamborghini Revuelto',
        model: '/models/lamborghini-glb/free_lamborghini_revuelto.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 350,
            acceleration: 2.5,
            handling: 9.6,
            braking: 9.5
        },
        scale: 1.0,
        position: [0, 0.5, 0]
    },
    {
        id: 'lamborghini-sesto-elemento',
        name: 'Lamborghini Sesto Elemento',
        model: '/models/lamborghini-glb/free_lamborghini_sesto_elemento.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 350,
            acceleration: 2.5,
            handling: 9.8,
            braking: 9.7
        },
        scale: 1.2,
        position: [0, 0.5, 0]
    },
    {
        id: 'lamborghini-terzo-millennio',
        name: 'Lamborghini Terzo Millennio',
        model: '/models/lamborghini-glb/free__lamborghini_terzo_millennio.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 360,
            acceleration: 2.3,
            handling: 9.9,
            braking: 9.8
        },
        scale: 1.0,
        position: [0, 0.5, 0]
    },
    {
        id: 'lamborghini-gallardo-2010',
        name: 'Lamborghini Gallardo 2010',
        model: '/models/lamborghini-glb/lamborghini_gallardo_2010.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 325,
            acceleration: 3.4,
            handling: 9.2,
            braking: 9.1
        },
        scale: 1.0,
        position: [0, 0.5, 0]
    },
    {
        id: 'lamborghini-centenario-roadster',
        name: 'Lamborghini Centenario Roadster',
        model: '/models/lamborghini-glb/lamborghini_centenario_roadster_sdc.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 350,
            acceleration: 2.8,
            handling: 9.7,
            braking: 9.6
        },
        scale: 1.0,
        position: [0, 0.5, 0]
    },
    {
        id: 'lamborghini-huracan-trofeo-evo2-2022',
        name: 'Lamborghini Huracán GT3 EVO2 2022',
        model: '/models/lamborghini-glb/2022__lamborghini_huracan_trofeo_evo2_thx_700.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 340,
            acceleration: 2.6,
            handling: 9.8,
            braking: 9.7
        },
        scale: 1.0,
        position: [0, 0.5, 0]
    },
    {
        id: 'lamborghini-countach-lpi-2021',
        name: 'Lamborghini Countach LPI 800-4 2021',
        model: '/models/lamborghini-glb/2021_lamborghini_countach_lpi_800-4.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 355,
            acceleration: 2.8,
            handling: 9.5,
            braking: 9.4
        },
        scale: 1.0,
        position: [0, 1.2, 0]
    },
    {
        id: 'lamborghini-aventador-j-2012',
        name: 'Lamborghini Aventador J Concept 2012',
        model: '/models/lamborghini-glb/2012_lamborghini_aventador_j_concept.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 350,
            acceleration: 2.9,
            handling: 9.5,
            braking: 9.4
        },
        scale: 200.0,
        position: [0, 0.5, 0]
    },
    {
        id: 'lamborghini-aventador-dlackdeath',
        name: 'Lamborghini Aventador DlackDeath',
        model: '/models/lamborghini-glb/lamborghini_aventador_by_faizan_dlackdeath.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 350,
            acceleration: 2.8,
            handling: 9.6,
            braking: 9.5
        },
        scale: 1.0,
        position: [0, 0.5, 2]
    },
    {
        id: 'lamborghini-urus-modified',
        name: 'Lamborghini Urus Modified',
        model: '/models/lamborghini-glb/modified_lamborghini_urus.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 305,
            acceleration: 3.6,
            handling: 8.8,
            braking: 9.0
        },
        scale: 0.1,
        position: [0, 0.5, 0]
    },
    {
        id: 'lamborghini-sian',
        name: 'Lamborghini Sián',
        model: '/models/lamborghini-glb/lamborghini-sian.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 350,
            acceleration: 2.8,
            handling: 9.6,
            braking: 9.5
        },
        scale: 1.0,
        position: [0, 0.5, 0]
    },
    {
        id: 'lamborghini-aventador-base',
        name: 'Lamborghini Aventador',
        model: '/models/lamborghini-glb/lamborghini-aventador.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 350,
            acceleration: 2.9,
            handling: 9.4,
            braking: 9.3
        },
        scale: 1.0,
        position: [0, 0.5, 0]
    },
    {
        id: 'lamborghini-revuelto-tm',
        name: 'Lamborghini Revuelto TM',
        model: '/models/lamborghini-glb/lamborghini_revuelto_tm.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 350,
            acceleration: 2.5,
            handling: 9.6,
            braking: 9.5
        },
        scale: 1.0,
        position: [0, 1.5, 0]
    },
    {
        id: 'lamborghini-huracan-gt3',
        name: 'Lamborghini Huracán GT3',
        model: '/models/lamborghini-glb/lamborghini_huracan_gt3.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 335,
            acceleration: 2.6,
            handling: 9.8,
            braking: 9.7
        },
        scale: 1.0,
        position: [0, 0.5, 0]
    },
    {
        id: 'lamborghini-countach-concept',
        name: 'Lamborghini Countach Concept',
        model: '/models/lamborghini-glb/lamborghini_countach_concept.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 355,
            acceleration: 2.8,
            handling: 9.5,
            braking: 9.4
        },
        scale: 1.0,
        position: [0, 0.8, 0]
    },
    {
        id: 'lamborghini-centenario-lp770-interior',
        name: 'Lamborghini Centenario LP770 Interior',
        model: '/models/lamborghini-glb/lamborghini_centenario_lp-770_interior_sdc.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 350,
            acceleration: 2.8,
            handling: 9.7,
            braking: 9.6
        },
        scale: 1.0,
        position: [0, 1.2, 0]
    },
    {
        id: 'lamborghini-centenario-lp770-blue',
        name: 'Lamborghini Centenario LP770 Baby Blue',
        model: '/models/lamborghini-glb/lamborghini_centenario_lp-770_baby_blue_sdc.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 350,
            acceleration: 2.8,
            handling: 9.7,
            braking: 9.6
        },
        scale: 1.0,
        position: [0, 0.5, 0]
    },
    {
        id: 'lamborghini-aventador-tm',
        name: 'Lamborghini Aventador TM',
        model: '/models/lamborghini-glb/lamborghini_aventadortm.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 350,
            acceleration: 2.8,
            handling: 9.6,
            braking: 9.5
        },
        scale: 1.0,
        position: [0, 0.5, 0]
    },
    {
        id: 'lamborghini-aventador-interior',
        name: 'Lamborghini Aventador with Interior',
        model: '/models/lamborghini-glb/lamborghini_aventador_with_interior.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 350,
            acceleration: 2.8,
            handling: 9.6,
            braking: 9.5
        },
        scale: 1.0,
        position: [0, 0.5, 0]
    },
    {
        id: 'lamborghini-aventador-sv',
        name: 'Lamborghini Aventador LP750-4 SV',
        model: '/models/lamborghini-glb/lamborghini_aventador_lp750-4_sv.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 350,
            acceleration: 2.8,
            handling: 9.7,
            braking: 9.6
        },
        scale: 0.01,
        position: [0, 0.5, 0]
    },
    {
        id: 'lamborghini-ferzor',
        name: 'Lamborghini Ferzor',
        model: '/models/lamborghini-glb/lamborghini_-_ferzor.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 355,
            acceleration: 2.7,
            handling: 9.8,
            braking: 9.7
        },
        scale: 1.0,
        position: [0, 0.5, 0]
    },
    {
        id: 'lamborghini-countach-se',
        name: 'Lamborghini Countach SE',
        model: '/models/lamborghini-glb/free_lamborghini_countach_se.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 355,
            acceleration: 2.8,
            handling: 9.5,
            braking: 9.4
        },
        scale: 1.0,
        position: [0, 0.5, 0]
    },
    {
        id: 'lamborghini-aventador-free',
        name: 'Lamborghini Aventador Free',
        model: '/models/lamborghini-glb/free_lamborghini_aventador.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 350,
            acceleration: 2.9,
            handling: 9.4,
            braking: 9.3
        },
        scale: 1.0,
        position: [0, 0.5, 0]
    },
    {
        id: 'lamborghini-v12-vision-gt',
        name: 'Lamborghini V12 Vision Gran Turismo',
        model: '/models/lamborghini-glb/free_-_lamborghini_v12_vision_gran_turismo_bysdc.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 360,
            acceleration: 2.4,
            handling: 9.9,
            braking: 9.8
        },
        scale: 1.0,
        position: [0, 0.5, 0]
    },
    {
        id: 'lamborghini-terzo-millennio-wind',
        name: 'Lamborghini Terzo Millennio Wind Tunnel',
        model: '/models/lamborghini-glb/free__lamborghini_terzo_millennio_wind_tunnel.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 360,
            acceleration: 2.3,
            handling: 9.9,
            braking: 9.8
        },
        scale: 1.0,
        position: [0, 0.5, 0]
    },
    {
        id: 'lamborghini-aventador-lp700',
        name: 'Lamborghini Aventador LP 700-4',
        model: '/models/lamborghini-glb/free__lamborghini_aventador_lp_700-4.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 350,
            acceleration: 2.9,
            handling: 9.4,
            braking: 9.3
        },
        scale: 1.0,
        position: [0, 0.5, 0]
    },
    {
        id: 'lamborghini-terzo-cyberpunk',
        name: 'Cyberpunk Lamborghini Terzo',
        model: '/models/lamborghini-glb/cyberpunk_lamborghini_terzo.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 360,
            acceleration: 2.3,
            handling: 9.9,
            braking: 9.8
        },
        scale: 1.0,
        position: [0, 0.5, 0]
    },
    {
        id: 'lamborghini-terzo-asphalt',
        name: 'Asphalt 9 Lamborghini Terzo Millennio',
        model: '/models/lamborghini-glb/asphalt_9_-_lamborghini_terzo_millennio_v2.glb',
        preview: '/images/cars/default.jpg',
        specs: {
            topSpeed: 360,
            acceleration: 2.3,
            handling: 9.9,
            braking: 9.8
        },
        scale: 1.0,
        position: [0, 0.5, 0]
    }
];

// 获取最新的车辆配置（包含数据库中保存的自定义设置）
export const getVehicles = async () => {
    try {
        // 初始化数据库
        await vehicleService.initializeVehicles();
        
        // 获取所有保存的车辆配置
        const savedConfigs = await Promise.all(
            vehiclesList.map(vehicle => vehicleService.getVehicle(vehicle.id))
        );
        
        // 合并基础配置和保存的配置
        return vehiclesList.map((baseConfig, index) => {
            const savedConfig = savedConfigs[index];
            if (savedConfig && savedConfig.customSettings) {
                return {
                    ...baseConfig,
                    scale: savedConfig.customSettings.scale || baseConfig.scale,
                    position: savedConfig.customSettings.position || baseConfig.position,
                    rotation: savedConfig.customSettings.rotation || baseConfig.rotation || -Math.PI/2,
                    colors: {
                        body: savedConfig.customSettings.colors?.body || baseConfig.colors?.body || '#2f426f',
                        wheel: savedConfig.customSettings.colors?.wheel || baseConfig.colors?.wheel || '#1a1a1a'
                    }
                };
            }
            return {
                ...baseConfig,
                rotation: baseConfig.rotation || -Math.PI/2,
                colors: baseConfig.colors || {
                    body: '#2f426f',
                    wheel: '#1a1a1a'
                }
            };
        });
    } catch (error) {
        console.error('获取车辆配置失败:', error);
        // 如果获取失败，返回基础配置
        return vehiclesList.map(config => ({
            ...config,
            rotation: config.rotation || -Math.PI/2,
            colors: config.colors || {
                body: '#2f426f',
                wheel: '#1a1a1a'
            }
        }));
    }
}; 