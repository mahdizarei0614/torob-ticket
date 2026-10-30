import type { Object3D } from 'three';

/** Reserved for the map's vehicle meshes. Geography, routes and bloom stay on
 * their existing layers; DOM annotations remain owned by the accessible UI. */
export const MAP_VEHICLE_FOREGROUND_LAYER = 30;
export const MAP_VEHICLE_FOREGROUND_KEY = 'torobTicketVehicleForeground';
export const MAP_VEHICLE_FOREGROUND_MASK = 1 << MAP_VEHICLE_FOREGROUND_LAYER;

export function setMapVehicleForeground(object: Object3D, separated: boolean, carriage = 0) {
  object.layers.set(separated ? MAP_VEHICLE_FOREGROUND_LAYER : 0);
  object.userData[MAP_VEHICLE_FOREGROUND_KEY] = separated;
  // The locomotive/head is above the nearest wagon, then the second wagon.
  object.renderOrder = 1002 - carriage;
}

export function hasMapVehicleForeground(scene: Object3D) {
  let found = false;
  scene.traverseVisible(object => {
    if (object.userData[MAP_VEHICLE_FOREGROUND_KEY] && object.layers.isEnabled(MAP_VEHICLE_FOREGROUND_LAYER)) found = true;
  });
  return found;
}
