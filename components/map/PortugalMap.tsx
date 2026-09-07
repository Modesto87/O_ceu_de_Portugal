'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Plus, Minus, RotateCcw } from 'lucide-react';
import type { Region } from '@/lib/weather/districts';
import { DISTRICTS } from '@/lib/weather/districts';
import { COASTAL_POINTS, seaPointForDistrict } from '@/lib/weather/coast';
import type { WeatherResponse, Layer } from '@/lib/weather/types';
import { hourIndex, value } from '@/lib/weather/format';
import { metricColor } from '@/lib/weather/colors';
import { compassAngle } from '@/lib/map/compass';
type Props = {
  region: Region;
  selected: string;
  onSelect: (id: string) => void;
  weather?: WeatherResponse;
  layer: Layer;
  offset: number;
};
type GeoFeature = {
  properties: { shapeISO: string };
  geometry: { type: string; coordinates: number[][][] | number[][][][] };
};
export default function PortugalMap(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const compassArrow = useRef<HTMLSpanElement>(null);
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });
  const commands = useRef<{
    zoom: (amount: number) => void;
    reset: () => void;
  } | null>(null);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let dispose = () => {};
    async function init() {
      const [THREE, { OrbitControls }, geo] = await Promise.all([
        import('three'),
        import('three/addons/controls/OrbitControls.js'),
        fetch('/portugal-districts.geojson').then((r) => {
          if (!r.ok) throw Error('Map unavailable');
          return r.json() as Promise<{ features: GeoFeature[] }>;
        }),
      ]);
      if (cancelled || !host.current || !labels.current) return;
      const container = host.current,
        overlay = labels.current;
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'low-power',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
      renderer.setClearColor(0, 0);
      container.appendChild(renderer.domElement);
      renderer.domElement.setAttribute(
        'aria-label',
        'Mapa 3D: arraste para rodar, use dois dedos para ampliar. Selecione também na lista de distritos.',
      );
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 150);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.09;
      controls.enablePan = true;
      controls.minDistance = 6;
      controls.maxDistance = 28;
      controls.maxPolarAngle = Math.PI / 2.4;
      controls.minPolarAngle = 0.12;
      controls.rotateSpeed = 0.65;
      let fitDistance = 16;
      const reset = () => {
        camera.position
          .set(1.7, 12.8, 8.2)
          .normalize()
          .multiplyScalar(fitDistance);
        controls.target.set(0, 0, 0);
        controls.update();
      };
      reset();
      commands.current = {
        reset,
        zoom: (amount) => {
          const v = camera.position.clone().sub(controls.target);
          v.multiplyScalar(amount);
          v.clampLength(6, 28);
          camera.position.copy(controls.target).add(v);
        },
      };
      scene.add(new THREE.HemisphereLight(0xd3faff, 0x06252b, 2.5));
      const light = new THREE.DirectionalLight(0xffe5b1, 3.3);
      light.position.set(-3, 10, 5);
      scene.add(light);
      const fill = new THREE.DirectionalLight(0x49bcca, 2);
      fill.position.set(4, 4, -5);
      scene.add(fill);
      const districts = DISTRICTS.filter((d) => d.region === props.region);
      const features: GeoFeature[] = geo.features.filter((f: GeoFeature) =>
        districts.some((d) => d.id === f.properties.shapeISO),
      );
      const polygons = (f: GeoFeature): number[][][][] =>
        f.geometry.type === 'Polygon'
          ? [f.geometry.coordinates as number[][][]]
          : (f.geometry.coordinates as number[][][][]);
      const allPoints = features.flatMap((f) => polygons(f).flat(2));
      const xs = allPoints.map((p) => p[0]),
        ys = allPoints.map((p) => p[1]);
      const minX = Math.min(...xs),
        maxX = Math.max(...xs),
        minY = Math.min(...ys),
        maxY = Math.max(...ys);
      const cx = (minX + maxX) / 2,
        cy = (minY + maxY) / 2,
        correction = Math.cos((cy * Math.PI) / 180);
      const scale = 8.7 / Math.max((maxX - minX) * correction, maxY - minY);
      const project = (p: number[]) =>
        new THREE.Vector2(
          (p[0] - cx) * correction * scale,
          (p[1] - cy) * scale,
        );
      const meshes: InstanceType<typeof THREE.Mesh>[] = [];
      const districtGroups: {
        id: string;
        group: InstanceType<typeof THREE.Group>;
        materials: InstanceType<typeof THREE.MeshStandardMaterial>[];
      }[] = [];
      for (const feature of features) {
        const group = new THREE.Group();
        scene.add(group);
        const materials: InstanceType<typeof THREE.MeshStandardMaterial>[] = [];
        for (const polygon of polygons(feature)) {
          if (polygon[0].length < 4) continue;
          const shape = new THREE.Shape(polygon[0].map(project));
          polygon
            .slice(1)
            .forEach((ring) =>
              shape.holes.push(new THREE.Path(ring.map(project))),
            );
          const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: 0.15,
            bevelEnabled: true,
            bevelThickness: 0.014,
            bevelSize: 0.009,
            bevelSegments: 1,
            steps: 1,
          });
          geometry.rotateX(-Math.PI / 2);
          const material = new THREE.MeshStandardMaterial({
            color: 0x33767b,
            roughness: 0.57,
            metalness: 0.25,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.userData.id = feature.properties.shapeISO;
          meshes.push(mesh);
          materials.push(material);
          group.add(mesh);
          group.add(
            new THREE.LineSegments(
              new THREE.EdgesGeometry(geometry, 25),
              new THREE.LineBasicMaterial({
                color: 0x88c3b7,
                transparent: true,
                opacity: 0.28,
              }),
            ),
          );
        }
        districtGroups.push({
          id: feature.properties.shapeISO,
          group,
          materials,
        });
      }
      const grid = new THREE.GridHelper(40, 60, 0x25444d, 0x19343e);
      grid.position.y = -0.08;
      (grid.material as InstanceType<typeof THREE.Material>).transparent = true;
      (grid.material as InstanceType<typeof THREE.Material>).opacity = 0.24;
      scene.add(grid);
      [4.9, 6.3, 7.7].forEach((radius) => {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(radius, radius + 0.012, 128),
          new THREE.MeshBasicMaterial({
            color: 0x599796,
            transparent: true,
            opacity: 0.19,
            side: THREE.DoubleSide,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = -0.06;
        scene.add(ring);
      });
      const labelEntries = districts.map((d) => {
        const button = document.createElement('button');
        button.className = 'map-label';
        button.setAttribute('aria-label', `Ver meteorologia de ${d.name}`);
        button.onclick = () => latest.current.onSelect(d.id);
        const name = document.createElement('span');
        name.textContent = d.name;
        const temp = document.createElement('strong');
        temp.textContent = '—';
        button.appendChild(name);
        button.appendChild(temp);
        overlay.appendChild(button);
        const pt = project([d.longitude, d.latitude]);
        return {
          id: d.id,
          button,
          temp,
          point: new THREE.Vector3(pt.x, 0.4, -pt.y),
        };
      });
      const seaEntries = COASTAL_POINTS.filter(
        (p) => p.region === props.region,
      ).map((p) => {
        const button = document.createElement('button');
        button.className = 'map-label sea';
        button.setAttribute(
          'aria-label',
          `Temperatura da água do mar em ${p.name}`,
        );
        button.onclick = () => latest.current.onSelect(p.districtId);
        const name = document.createElement('span');
        name.textContent = p.name;
        const temp = document.createElement('strong');
        temp.textContent = '—';
        button.appendChild(name);
        button.appendChild(temp);
        overlay.appendChild(button);
        const pt = project([p.longitude, p.latitude]);
        const marker = new THREE.Mesh(
          new THREE.CircleGeometry(0.09, 24),
          new THREE.MeshBasicMaterial({
            color: 0x2b6c9e,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
          }),
        );
        marker.rotation.x = -Math.PI / 2;
        marker.position.set(pt.x, 0.02, -pt.y);
        scene.add(marker);
        return {
          id: p.id,
          button,
          temp,
          marker,
          point: new THREE.Vector3(pt.x, 0.05, -pt.y),
        };
      });
      const resize = () => {
        const { width, height } = container.getBoundingClientRect();
        renderer.setSize(width, height);
        camera.aspect = width / Math.max(height, 1);
        camera.updateProjectionMatrix();
        fitDistance = Math.max(
          16,
          ((maxX - minX) * correction * scale + 1.8) /
            (2 * Math.tan(Math.PI / 10) * camera.aspect),
        );
        controls.maxDistance = Math.max(28, fitDistance * 1.6);
        reset();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(container);
      resize();
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let down = { x: 0, y: 0 };
      let hovered = '';
      const intersect = (event: PointerEvent) => {
        const r = renderer.domElement.getBoundingClientRect();
        pointer.set(
          ((event.clientX - r.left) / r.width) * 2 - 1,
          (-(event.clientY - r.top) / r.height) * 2 + 1,
        );
        raycaster.setFromCamera(pointer, camera);
        return raycaster.intersectObjects(meshes, false)[0]?.object.userData
          .id as string | undefined;
      };
      const onDown = (e: PointerEvent) => {
        down = { x: e.clientX, y: e.clientY };
      };
      const onUp = (e: PointerEvent) => {
        if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) {
          const id = intersect(e);
          if (id) latest.current.onSelect(id);
        }
      };
      const onMove = (e: PointerEvent) => {
        hovered = intersect(e) || '';
        renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
      };
      renderer.domElement.addEventListener('pointerdown', onDown);
      renderer.domElement.addEventListener('pointerup', onUp);
      renderer.domElement.addEventListener('pointermove', onMove);
      const onContextLost = (e: Event) => {
        e.preventDefault();
        setError(true);
      };
      renderer.domElement.addEventListener('webglcontextlost', onContextLost);
      let frame = 0,
        last = 0;
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const render = (time: number) => {
        frame = requestAnimationFrame(render);
        if (document.hidden || time - last < 32) return;
        last = time;
        const { selected, weather, layer, offset } = latest.current;
        for (const entry of districtGroups) {
          const active = entry.id === selected;
          const target = active ? 0.22 : entry.id === hovered ? 0.1 : 0;
          entry.group.position.y = reduced
            ? target
            : THREE.MathUtils.lerp(entry.group.position.y, target, 0.12);
          const f = weather?.districts[entry.id];
          const ix = f ? hourIndex(f.hourly.time) + offset : 0;
          const metric =
            layer === 'rain'
              ? f?.hourly.precipitation_probability[ix]
              : layer === 'wind'
                ? f?.hourly.wind_speed_10m[ix]
                : layer === 'sea'
                  ? undefined
                  : offset
                    ? f?.hourly.temperature_2m[ix]
                    : f?.current.temperature_2m;
          const color = new THREE.Color(
            active
              ? '#d6bd7a'
              : layer === 'sea'
                ? '#36515b'
                : metricColor(layer, metric),
          );
          entry.materials.forEach((m) => {
            m.color.lerp(color, reduced ? 1 : 0.12);
            m.emissive.set(active ? '#332808' : '#000000');
          });
        }
        controls.update();
        if (compassArrow.current) {
          const origin = new THREE.Vector3(0, 0, 0).project(camera);
          const north = new THREE.Vector3(0, 0, -1).project(camera);
          const angle = compassAngle(origin.x, origin.y, north.x, north.y);
          compassArrow.current.style.transform = `rotate(${angle}deg)`;
        }
        const width = container.clientWidth,
          height = container.clientHeight;
        labelEntries.forEach((entry) => {
          const active = entry.id === selected;
          const display =
            active ||
            (layer !== 'sea' &&
              ((width > 460 &&
                [
                  'PT-13',
                  'PT-04',
                  'PT-06',
                  'PT-05',
                  'PT-07',
                  'PT-08',
                  'PT-11',
                ].includes(entry.id)) ||
                props.region !== 'continent'));
          const pos = entry.point.clone();
          pos.y = active ? 0.72 : 0.45;
          pos.project(camera);
          entry.button.style.display =
            display && Math.abs(pos.x) < 0.96 && Math.abs(pos.y) < 0.93
              ? ''
              : 'none';
          entry.button.style.transform = `translate(-50%,-100%) translate(${(pos.x * 0.5 + 0.5) * width}px,${(-pos.y * 0.5 + 0.5) * height}px)`;
          entry.button.classList.toggle('selected', active);
          const f = weather?.districts[entry.id];
          const ix = f ? hourIndex(f.hourly.time) + offset : 0;
          entry.temp.textContent =
            layer === 'rain'
              ? value(f?.hourly.precipitation_probability[ix], '%')
              : layer === 'wind'
                ? value(f?.hourly.wind_speed_10m[ix], ' km/h')
                : layer === 'sea'
                  ? value(
                      weather?.sea?.[
                        seaPointForDistrict(entry.id)?.id ?? ''
                      ],
                      '°',
                    )
                  : value(
                      offset
                        ? f?.hourly.temperature_2m[ix]
                        : f?.current.temperature_2m,
                      '°',
                    );
        });
        seaEntries.forEach((entry) => {
          const sst = weather?.sea?.[entry.id];
          const pos = entry.point.clone();
          pos.y = 0.18;
          pos.project(camera);
          entry.button.style.display =
            layer === 'sea' && Math.abs(pos.x) < 0.96 && Math.abs(pos.y) < 0.93
              ? ''
              : 'none';
          entry.button.style.transform = `translate(-50%,-100%) translate(${(pos.x * 0.5 + 0.5) * width}px,${(-pos.y * 0.5 + 0.5) * height}px)`;
          entry.temp.textContent = value(sst, '°');
          entry.marker.visible = layer === 'sea';
          const target = new THREE.Color(metricColor('sea', sst));
          (entry.marker.material as InstanceType<typeof THREE.MeshBasicMaterial>).color.lerp(
            target,
            reduced ? 1 : 0.12,
          );
        });
        renderer.render(scene, camera);
      };
      frame = requestAnimationFrame(render);
      setReady(true);
      dispose = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        controls.dispose();
        renderer.domElement.removeEventListener(
          'webglcontextlost',
          onContextLost,
        );
        renderer.dispose();
        scene.traverse((o) => {
          if ('geometry' in o)
            (o.geometry as InstanceType<typeof THREE.BufferGeometry>).dispose();
          if ('material' in o) {
            const m = o.material as
              | InstanceType<typeof THREE.Material>
              | InstanceType<typeof THREE.Material>[];
            (Array.isArray(m) ? m : [m]).forEach((item) => item.dispose());
          }
        });
        renderer.domElement.remove();
        overlay.replaceChildren();
        commands.current = null;
      };
    }
    init().catch(() => {
      if (!cancelled) setError(true);
    });
    return () => {
      cancelled = true;
      dispose();
    };
  }, [props.region]);
  return (
    <div className="map-viewport">
      <div ref={host} className="three-host" />
      <div ref={labels} className="map-labels" />
      {!ready && !error && (
        <div className="map-loading">
          <span className="loading-orbit" />A preparar Portugal em 3D…
        </div>
      )}
      {error && (
        <div className="map-loading">
          O mapa 3D não está disponível neste dispositivo.
          <br />
          Pode consultar todos os distritos na lista.
        </div>
      )}
      <div className="ocean-label">
        OCEANO
        <br />
        ATLÂNTICO
      </div>
      <div className="map-compass" aria-label="Norte geográfico">
        <span ref={compassArrow} className="compass-arrow" aria-hidden="true">
          <svg viewBox="0 0 20 22">
            <path d="M10 1.5 16.5 19 10 15.5 3.5 19Z" />
          </svg>
        </span>
        <span>N</span>
      </div>
      <div className="map-controls">
        <button
          aria-label="Aproximar mapa"
          onClick={() => commands.current?.zoom(0.82)}
        >
          <Plus size={19} />
        </button>
        <button
          aria-label="Afastar mapa"
          onClick={() => commands.current?.zoom(1.22)}
        >
          <Minus size={19} />
        </button>
        <button
          aria-label="Repor vista do mapa"
          onClick={() => commands.current?.reset()}
        >
          <RotateCcw size={17} />
        </button>
      </div>
      <div className="map-hint">
        <span className="live-dot" /> Arraste para explorar · Toque num distrito
      </div>
    </div>
  );
}
