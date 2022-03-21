import React, {useState, useEffect} from 'react'
import {StyleSheet, Image, TouchableOpacity, Platform, ActivityIndicator, Dimensions, LogBox} from 'react-native'
import {Button, Text, View} from '../components/Themed'
import __ from '../misc/localisation'
import {signOut} from '../services/user'
import {RootTabScreenProps} from '../types';
import {db} from '../services/firebase'
import * as ImagePicker from "expo-image-picker";
import {storage} from '../services/firebase';
import { SimpleLineIcons} from '@expo/vector-icons'
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import * as FileSystem from 'expo-file-system'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore'
import Colors from '../constants/Colors'

const SCREEN_WIDTH= Dimensions.get('window').width
const SCREEN_HEIGHT= Dimensions.get('window').height

export default function Profile({ }: RootTabScreenProps<'Profile'>) {
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [sucess, setSucess] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    //requestPermission
    (async () => {
      if (Platform.OS !== "web") {
        const {
          status,
        } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          alert("Sorry, we need camera roll permissions to make this work!");
        }
      }
    })();
    //getFirebase data
    (async () => {
      //Get userId
      const userId = await AsyncStorage.getItem('userId');
      setUserId(userId);
      setUploading(true);
      getDoc(doc(db, 'users', userId)).then((res)=> {
        if(res.exists()){
          setImage(res.data()?.profileURL)
        } else {
          return null
        }
        setTimeout(() => {
          setUploading(false)
        },2000)
      }).catch((error) => {
        console.log("error", error)
      })
    })()
  }, []);

  //fileinfo
  const getFileInfo = async (fileURI: string) => {
    const fileInfo = await FileSystem.getInfoAsync(fileURI)
    return fileInfo
  }

  //FileSize check for less than 5mb
  const isLessThanTheMB = (fileSize: number, smallerThanSizeMB: number) => {
    const isOk = fileSize / 1024 / 1024 < smallerThanSizeMB
    return isOk
  }

  //pickImage for profile
  const pickImage = async () => {
    let pickerResult = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [4, 3],
    });
    await handleImagePicked(pickerResult);
  };

//check file size and upload firebase
  const handleImagePicked = async (pickerResult: any) => {
    try {
      setUploading(true);
      const { uri, type } = pickerResult;
      const fileInfo = await getFileInfo(uri)
      if (!fileInfo?.size) {
        alert("Can't select this file as the size is unknown.")
        return
      }
      if (type === 'image') {
        const isLt5MB = isLessThanTheMB(fileInfo.size, 5)
        if (!isLt5MB) {
          alert(`Image size must be smaller than 5MB!`)
          return
        }
      }
      if (!pickerResult.cancelled) {
        const uploadUrl = await uploadImageAsync(pickerResult.uri);
        console.log("uploadUrl", uploadUrl)
        if(uploadUrl) {
          setDoc(doc(db, 'users', userId), {
            profileURL: uploadUrl
          }, {merge: true})
            .then(() => {
              setUploading(false);
              console.debug('User successfully added to db.')
              })
            .catch(error => {
              console.error(error)
            })
          setImage(uploadUrl)
          setSucess('Profile updated successfully');
          hideSuccess();
          setUploading(false);
        }
      }
    } catch (e) {
      setUploading(false)
      console.log(e);
    } finally {
      setUploading(false)
    }
  };

  //hide notification
  const hideSuccess=()=>{
    setTimeout(()=>{
      setSucess('')
    },3000)
  }

  //notification for sucess
  const AlertView = () => {
    if(sucess===''){
      return null;
    }
    return(
      <View style={{ borderRadius:10,position:'absolute',width:'90%',padding:10, bottom:10, backgroundColor:Colors.light.success, justifyContent:'center', alignItems:'center'}}>
        <Text style={{color:'white'}}>
          {sucess}
        </Text>
      </View>
    )
  }

  const uploadImageAsync = async (uri: any) => {
    const blob = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        resolve(xhr.response);
      };
      xhr.onerror = function (e) {
        console.log(e);
        reject(new TypeError("Network request failed"));
      };
      xhr.responseType = "blob";
      xhr.open("GET", uri, true);
      xhr.send(null);
    });

    const fileRef = ref(storage, `${userId}/profileURL.jpg`)
    if(fileRef){
      // We're done with the blob, close and release it
      const result = await uploadBytes(fileRef, blob);
      blob.close();
      console.log("fileRef", fileRef);
      return await getDownloadURL(fileRef);
    }
  }

  LogBox.ignoreLogs(['Warning: ...']);
  LogBox.ignoreAllLogs();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.profilePicContainer}>
        <View style={styles.profilePicStyle}>
          {uploading ? (
            <ActivityIndicator size={'small'} color='blue'/>
          ): image ? (
            <Image style={styles.profilePicStyle} source={{uri: image}}/>
          ) :   <Image style={styles.profilePicStyle} source={require('../assets/images/profile.jpg')}/>}
        </View>
        <TouchableOpacity
          style={styles.editProfilePicStyle}
          onPress={pickImage}
        >
          <SimpleLineIcons name="camera" size={18} color="black" />
        </TouchableOpacity>
      </View>
      <View
        style={styles.separator}
        lightColor='#eee'
        darkColor='rgba(255,255,255,0.1)'
      />
      <Button status='neutral' onPress={signOut}>
        {__.AUTH.SIGN_OUT}
      </Button>
      <AlertView/>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  separator: {
    marginVertical: 25,
    height: 1,
    width: '80%',
  },
  header:{
    justifyContent:'center',
    alignItems:'center',
    position:'absolute',
    marginBottom:100
  },
  avatar: {
    width: SCREEN_WIDTH/3,
    height: SCREEN_WIDTH/3,
    borderRadius: SCREEN_WIDTH/1.5,
    borderWidth: 4,
    borderColor: "#0000ff",
    alignSelf:'center',
    marginTop:SCREEN_HEIGHT/15,
  },
  profilePicContainer: {
    width: SCREEN_WIDTH,
    alignItems: "center"
  },
  profilePicStyle: {
    borderRadius: SCREEN_WIDTH / 3.25 / 2,
    borderWidth: 3,
    borderColor: Colors.light.primary,
    width: SCREEN_WIDTH / 3.25,
    height: SCREEN_WIDTH / 3.25,
    justifyContent: "center",
    alignItems: "center"
  },
  editProfilePicStyle: {
    backgroundColor:'lightgray',
    width: 45,
    height: 45,
    position: "absolute",
    marginTop: SCREEN_WIDTH / 4.5,
    right: SCREEN_WIDTH / 2.8,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "white",
    alignItems: "center",
    justifyContent: "center"
  },
})
