<?
$vkId = '30647716';
$vkToken = '30647716';
$accessToken = '21430af081599c4b5493d65b1049ac573aaf9ed79172b0fd9f23cd78fe8a8ba8870add04bdef6acb38cff';

ini_set('max_execution_time', 9600);
ini_set('memory_limit', '2200M');
set_time_limit(9600);

$groupId = 30416622;//детсад
$fields = 'last_seen';

//$resp = file_get_contents("https://api.vk.com/method/execute.getGroupMembers")
$getContent = 'access_token=' . $accessToken . '&groupId=' . $groupId . '&offset=0&fields=' . $fields;

for ($i = 0; $i < 20; $i++) {
    $curl = curl_init("https://api.vk.com/method/execute.getGroupMembers?");
    curl_setopt($curl, CURLOPT_URL, 'https://api.vk.com/method/execute.getGroupMembers?' . $getContent);
    curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
    $out = curl_exec($curl);

    echo '<pre>'.$i;
    //print_r(json_decode($out));
    echo '</pre><br>';
}

curl_close($curl);

?>