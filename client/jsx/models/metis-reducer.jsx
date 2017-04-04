export default class MetisReducer{

  reducer(){

    return (state = {}, action)=>{

      // Extract some widely use items.
      var fileData = Object.assign({}, state);
      if('fileUploads' in fileData) var fileUploads = fileData['fileUploads'];
      if('fileList' in fileData) var fileList = fileData['fileList'];

      switch(action['type']){

        case 'FILE_SELECTED':

          // Copy the selected file data to 'fileUploads' object.
          action['fileObject']['fileName'] = action['fileObject']['name'];
          action['fileObject']['originalName'] = action['fileObject']['name'];
          action['fileObject']['fileSize'] = action['fileObject']['size'];
          action['fileObject']['currentBytePosition'] = 0;
          action['fileObject']['status'] = 'unauthorized';
          action['fileObject']['reactKey'] = GENERATE_RAND_KEY();
          fileData['fileUploads'].push(action['fileObject']);
          break;

        case 'FILE_UPLOAD_AUTHORIZED':

          var authResponse = Object.assign({}, action['authResponse']);
          authResponse = this.camelCaseIt(authResponse['request']);

          // Find the local File Object.
          var index = this.getMatchingUploadIndex(fileUploads, authResponse);

          // Append the HMAC signature and set the server current byte to 0.
          fileUploads[index]['hmacSignature'] = authResponse['hmacSignature'];
          fileUploads[index]['currentBytePosition'] = 0;

          // Append all of the request items to the local file object.
          fileUploads[index] = Object.assign(fileUploads[index], authResponse);
          break;

        case 'FILE_INITIALIZED':
        case 'FILE_UPLOAD_ACTIVE':

          var activeResponse = Object.assign({}, action['uploadResponse']);
          activeResponse = this.camelCaseIt(activeResponse['request']);

          // Find the local File Object.
          var index = this.getMatchingUploadIndex(fileUploads, activeResponse);

          // Append all of the request items to the local file object.
          fileUploads[index] = Object.assign(fileUploads[index],activeResponse);
          break;

        case 'FILE_UPLOAD_COMPLETE':

          var completeResponse = Object.assign({}, action['completeResponse']);
          completeResponse = this.camelCaseIt(completeResponse['request']);

          // Find the local File Object.
          var index = this.getMatchingUploadIndex(fileUploads, activeResponse);

          /*
           * Move the completed upload metadata from the 'uploads' array to the 
           * list array.
           */
          fileUploads.splice(index, 1);
          fileList.push(completeResponse);
          break;

        case 'FILE_METADATA_RECEIVED':

          for(var a = 0; a < action['fileList']['length']; ++a){

            var file = this.camelCaseIt(action['fileList'][a]);
            file['reactKey'] = GENERATE_RAND_KEY();

            if(!action['fileList'][a].hasOwnProperty('finishTimestamp')){

              fileData['fileFails'].push(file);
            }
            else{

              fileData['fileList'].push(file);
            }
          }
          break;

        case 'FILE_UPLOAD_PAUSED':

          // MOD START
          var reqData = this.camelCaseIt(action['pauseResponse']['request']);
          for(var a = 0; a < fileUploads['length']; ++a){

            if(fileUploads[a]['dbIndex'] == reqData['dbIndex']){

              for(var key in reqData){

                fileUploads[a][key] = reqData[key];
              }
              break;
            }
          }
          break;

        case 'QUEUE_UPLOAD':

          for(var a = 0; a < fileUploads['length']; ++a){

            // Remove any 'queued' status
            if(fileUploads[a]['status'] == 'queued'){

              if(fileUploads[a]['currentBytePosition'] == 0){

                fileUploads[a]['status'] = 'initialized';
              }
              else{

                fileUploads[a]['status'] = 'paused';
              }
            }

            // Apply a 'queued' status to a matching file upload.
            if(fileUploads[a]['dbIndex'] == action['dbIndex']){

              fileUploads[a]['status'] = 'queued';
            }
          }
          break;

        case 'FILE_UPLOAD_CANCELLED':

          var cancelledFile = action['cancelledResponse']['request'];

          for(var a = 0; a < fileUploads['length']; ++a){

            if(fileUploads[a]['dbIndex'] == cancelledFile['redis_index']){

              fileUploads[a]['status'] = 'cancelled';
              fileData['fileFails'].push(fileUploads[a]);
              fileUploads.splice(a, 1);
            }
          }
          break;

        case 'FILE_REMOVED':

          var oldMetadata = action['oldMetadata'];

          for(var key in fileData){

            var fileRemoved = false;
            for(var a = 0; a < fileData[key]['length']; ++a){

              if(fileData[key][a]['dbIndex'] == oldMetadata['redis_index']){

                fileData[key].splice(a, 1);
                fileRemoved = true;
                break;
              }
            }

            if(fileRemoved){

              break;
            }
          }

          break;
        default:

          break;
      }

      return fileData;
    };
  }

  camelCaseIt(object){

    for(var key in object){

      object[CAMEL_CASE_IT(key)] = object[key];
      if(key.indexOf('_') != -1) delete object[key];
    }

    object = PARSE_REQUEST(object);
    return object;
  }

  // Find the local File Object.
  getMatchingUploadIndex(fileUploads, responseData){

    var index = 0;
    for(var a = 0; a < fileUploads['length']; ++a){

      if((fileUploads[a]['fileName'] == responseData['fileName']) &&
        (fileUploads[a]['projectName'] == responseData['projectName']) &&
        (fileUploads[a]['groupName'] == responseData['groupName'])){

        index = a; 
        break;
      }
    }
    return index;
  }
}