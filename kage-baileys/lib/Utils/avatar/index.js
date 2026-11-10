'use strict';

const generator = require('./avatar-generator.js');
const getPic = require('./get-profile-pic.js');

module.exports = {
  ...generator,
  ...getPic,
  // aliases en inglés para quien prefiera
  generateAvatar: generator.generarAvatar,
  getProfilePicture: getPic.obtenerFotoPerfil,
  getProfilePictureBuffer: getPic.obtenerFotoPerfilBuffer,
  getDefaultAvatar: getPic.obtenerAvatarPorDefecto,
  asImage: getPic.comoImagen,
  asPhotoUrl: getPic.comoUrlFoto
};
